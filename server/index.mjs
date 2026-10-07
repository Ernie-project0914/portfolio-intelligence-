import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.mjs";
import { PortfolioService } from "./service.mjs";
import { ValidationError } from "./engine.mjs";
export function createApp(service, options = {}) {
  const limits = new Map();
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    const path = new URL(req.url, "http://localhost").pathname;
    const method = req.method;
    const send = (body, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    };
    const cookies = Object.fromEntries(
      (req.headers.cookie || "")
        .split(";")
        .filter((x) => x.includes("="))
        .map((x) => {
          const i = x.indexOf("=");
          return [x.slice(0, i).trim(), x.slice(i + 1).trim()];
        }),
    );
    const token = cookies.folio_session;
    const setCookie = (t) =>
      res.setHeader(
        "Set-Cookie",
        `folio_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${t ? 604800 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
    try {
      if (path === "/api/health" && method === "GET")
        return send({ ok: true, database: true });
      if (!path.startsWith("/api/")) {
        if (method !== "GET") return send({ error: "Not found" }, 404);
        const root = resolve(options.staticDir || "dist");
        let file = resolve(root, "." + decodeURIComponent(path));
        if (!file.startsWith(root + sep)) file = resolve(root, "index.html");
        if (!existsSync(file) || !statSync(file).isFile())
          file = resolve(root, "index.html");
        if (!existsSync(file))
          return send({ error: "Build the frontend first" }, 404);
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
        );
        res.setHeader(
          "Content-Type",
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".html": "text/html",
            ".svg": "image/svg+xml",
            ".json": "application/json",
          }[extname(file)] || "application/octet-stream",
        );
        return res.end(readFileSync(file));
      }
      let raw = {};
      if (!["GET", "HEAD"].includes(method)) {
        if (
          req.headers["x-folio-client"] !== "1" ||
          !String(req.headers["content-type"] || "").startsWith(
            "application/json",
          )
        )
          throw new ValidationError(
            "JSON and application client header required",
            403,
          );
        const origin = req.headers.origin;
        if (origin) {
          let valid = false;
          try {
            const u = new URL(origin);
            valid =
              ["http:", "https:"].includes(u.protocol) &&
              (u.host === req.headers.host ||
                origin === service.env.FOLIO_PUBLIC_ORIGIN);
          } catch {}
          if (!valid)
            throw new ValidationError("Cross-origin write rejected", 403);
        }
        let text = "";
        for await (const chunk of req) {
          text += chunk;
          if (Buffer.byteLength(text) > 1100000)
            throw new ValidationError("Request exceeds 1 MB", 413);
        }
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new ValidationError("Invalid JSON");
        }
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new ValidationError("JSON object required");
      }
      if (
        ["/api/auth/login", "/api/auth/register", "/api/auth/demo"].includes(
          path,
        ) &&
        method === "POST"
      ) {
        const ip = req.socket.remoteAddress;
        const key = ip + ":" + path;
        const limit = limits.get(key) || {
          count: 0,
          until: Date.now() + 60000,
        };
        if (limit.until < Date.now()) {
          limit.count = 0;
          limit.until = Date.now() + 60000;
        }
        if (++limit.count > 10)
          throw new ValidationError(
            "Too many authentication attempts; wait one minute",
            429,
          );
        limits.set(key, limit);
        if (limits.size > 10000) limits.clear();
        const existing = service.user(token);
        const user = path.endsWith("/demo")
          ? existing?.kind === "demo"
            ? existing
            : service.createDemo()
          : path.endsWith("/register")
            ? service.register(raw)
            : service.login(raw);
        if (token) service.logout(token);
        setCookie(service.session(user));
        return send({ user });
      }
      if (path === "/api/auth/session" && method === "GET")
        return send({
          user: service.user(token),
          ownerExists: !!service.db
            .prepare("SELECT id FROM users WHERE kind='private'")
            .get(),
        });
      const user = service.user(token);
      if (!user) throw new ValidationError("Authentication required", 401);
      if (path === "/api/auth/logout" && method === "POST") {
        service.logout(token);
        setCookie("");
        return send({ ok: true });
      }
      if (path === "/api/state" && method === "GET")
        return send(service.state(user));
      if (path === "/api/transactions" && method === "POST") {
        const r = service.addTransactions(user, raw.accountId, [raw]);
        service.snapshot(user);
        service.evaluateAlerts(user);
        return send(r, 201);
      }
      if (path === "/api/import" && method === "POST") {
        const r = service.importCSV(user, raw);
        if (raw.commit) {
          service.snapshot(user);
          service.evaluateAlerts(user);
        }
        return send(r);
      }
      if (path === "/api/accounts" && method === "POST") {
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name || name.length > 100)
          throw new ValidationError("Account name must be 1–100 characters");
        if (service.accounts(user).length >= 20)
          throw new ValidationError("Maximum 20 accounts");
        service.db
          .prepare(
            "INSERT INTO broker_accounts(id,user_id,name) VALUES (?,?,?)",
          )
          .run(randomUUID(), user.id, name);
        return send({ ok: true }, 201);
      }
      if (path === "/api/watchlist" && ["POST", "DELETE"].includes(method)) {
        service.watch(user, raw.ticker, method === "DELETE");
        return send({ ok: true });
      }
      if (path === "/api/snapshots" && method === "POST")
        return send(service.snapshot(user), 201);
      if (path === "/api/history" && method === "GET")
        return send(
          service.history(
            user,
            new URL(req.url, "http://localhost").searchParams.get("period") ||
              "1Y",
          ),
        );
      if (path === "/api/analytics" && method === "GET")
        return send(service.analytics(user));
      if (path === "/api/alerts" && method === "POST") {
        service.createAlert(user, raw);
        return send({ ok: true }, 201);
      }
      if (path === "/api/alerts/evaluate" && method === "POST") {
        service.evaluateAlerts(user);
        return send({ ok: true });
      }
      if (path.startsWith("/api/alerts/") && method === "DELETE") {
        service.db
          .prepare("DELETE FROM alerts WHERE id=? AND user_id=?")
          .run(path.split("/").at(-1), user.id);
        return send({ ok: true });
      }
      if (path === "/api/notifications/read" && method === "POST") {
        service.db
          .prepare("UPDATE notifications SET read=1 WHERE user_id=?")
          .run(user.id);
        return send({ ok: true });
      }
      if (path === "/api/settings" && method === "PATCH") {
        service.settings(user, raw);
        return send({ ok: true });
      }
      if (
        /^\/api\/security\/[A-Z0-9.:-]+\/metadata$/.test(path) &&
        method === "PATCH"
      ) {
        service.securityMetadata(user, path.split("/")[3], raw);
        return send({ ok: true });
      }
      if (path === "/api/quotes" && method === "POST") {
        service.privateOnly(user);
        const ticker = String(raw.ticker || "").toUpperCase();
        if (
          !/^[A-Z0-9][A-Z0-9.:-]{0,24}$/.test(ticker) ||
          typeof raw.price !== "number" ||
          !Number.isFinite(raw.price) ||
          raw.price <= 0 ||
          raw.price > 1e7 ||
          (raw.previousClose !== null &&
            (typeof raw.previousClose !== "number" ||
              !Number.isFinite(raw.previousClose) ||
              raw.previousClose <= 0 ||
              raw.previousClose > 1e7))
        )
          throw new ValidationError("Invalid manual quote");
        service.ensureSecurity(ticker);
        service.db
          .prepare("INSERT OR REPLACE INTO price_history VALUES(?,?,?,?,?,?)")
          .run(
            ticker,
            new Date().toISOString(),
            raw.price,
            raw.previousClose,
            "MANUAL",
            "User entry",
          );
        service.snapshot(user);
        service.evaluateAlerts(user);
        return send({ ok: true });
      }
      if (
        /^\/api\/security\/[A-Z0-9.:-]+\/history$/.test(path) &&
        method === "GET"
      ) {
        const ticker = path.split("/")[3];
        if (user.kind === "demo") {
          const h = service
            .state(user)
            .holdings.find((h) => h.ticker === ticker);
          if (!h)
            throw new ValidationError(
              "Demo history is unavailable for this security",
              404,
            );
          const points = service.history(
            user,
            new URL(req.url, "http://localhost").searchParams.get("period") ||
              "1Y",
          ).points;
          const last = points.at(-1).value;
          return send({
            mode: "DEMO",
            synthetic: true,
            points: points.map((p) => ({
              date: p.date,
              value: (p.value / last) * h.price,
            })),
          });
        }
        const all = await service.market(user).getHistoricalPrices(ticker);
        const period =
          new URL(req.url, "http://localhost").searchParams.get("period") ||
          "1Y";
        const days = {
          "1D": 1,
          "5D": 5,
          "1M": 30,
          "3M": 90,
          "6M": 180,
          "1Y": 365,
          "5Y": 1825,
          MAX: 100000,
          YTD:
            (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) /
            86400000,
        };
        const cutoff = Date.now() - (days[period] || 365) * 86400000;
        const points = all.filter((p) => Date.parse(p.date) >= cutoff);
        return send({
          mode: "DELAYED",
          synthetic: false,
          points,
          note:
            "Daily closes only. Available provider coverage: " +
            (all[0]?.date.slice(0, 10) || "none") +
            " to " +
            (all.at(-1)?.date.slice(0, 10) || "none") +
            ". Intraday and longer history depend on provider availability.",
        });
      }
      if (
        /^\/api\/security\/[A-Z0-9.:-]+\/fundamentals$/.test(path) &&
        method === "GET"
      )
        return send(
          await service.market(user).getFundamentals(path.split("/")[3]),
        );
      if (path === "/api/market/history" && method === "POST")
        return send(await service.loadRiskHistories(user));
      if (path === "/api/market/refresh" && method === "POST")
        return send(await service.refreshQuotes(user));
      if (path === "/api/news" && method === "GET")
        return send(service.news(user));
      if (path === "/api/news/refresh" && method === "POST")
        return send(await service.refreshNews(user));
      if (path === "/api/events" && method === "GET")
        return send(service.events(user));
      if (path === "/api/events" && method === "POST") {
        service.event(user, raw);
        return send({ ok: true }, 201);
      }
      if (path.startsWith("/api/events/") && method === "DELETE") {
        service.db
          .prepare("DELETE FROM calendar_events WHERE id=? AND user_id=?")
          .run(path.split("/").at(-1), user.id);
        return send({ ok: true });
      }
      if (path === "/api/broker/sync" && method === "POST")
        return send(await service.syncBroker(user, raw));
      if (path === "/api/broker/disconnect" && method === "POST") {
        service.disconnect(user);
        return send({ ok: true });
      }
      if (path === "/api/broker/history" && method === "POST")
        return send(await service.brokerHistory(user));
      if (path === "/api/assistant" && method === "POST")
        return send(service.assistant(user, raw));
      if (path === "/api/briefings" && method === "GET")
        return send(service.briefings(user));
      if (path === "/api/briefings" && method === "POST")
        return send(await service.dailyBriefing(user, { force: true }));
      if (path === "/api/research" && method === "POST")
        return send(await service.research(user, raw));
      if (path === "/api/research" && method === "GET")
        return send(
          service.db
            .prepare(
              "SELECT id,timestamp,report_json FROM research_reports WHERE user_id=? ORDER BY timestamp DESC LIMIT 20",
            )
            .all(user.id)
            .map((r) => ({ id: r.id, ...JSON.parse(r.report_json) })),
        );
      if (path === "/api/export" && method === "GET") {
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="folio-backup.json"',
        );
        return send(service.export(user));
      }
      throw new ValidationError("Endpoint not found", 404);
    } catch (e) {
      if (!res.headersSent)
        send(
          {
            error:
              e instanceof ValidationError
                ? e.message
                : "Unexpected server error",
          },
          e.status || 500,
        );
      else res.end();
    }
  });
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const dataDir = resolve(process.env.FOLIO_DATA_DIR || ".data");
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = openDatabase(joinPath(dataDir, "folio.sqlite"));
  const service = new PortfolioService(db, { dataDir });
  const app = createApp(service);
  const port = Number(process.env.PORT || process.env.FOLIO_API_PORT || 3001);
  const host = process.env.FOLIO_HOST || "127.0.0.1";
  app.listen(port, host, () =>
    console.log(
      `Folio API listening on ${host}:${port}; database migrations applied`,
    ),
  );
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      for (const u of db.prepare("SELECT id,kind,email FROM users").all()) {
        try {
          service.evaluateAlerts(u);
          if (u.kind === "private") await service.dailyBriefing(u);
        } catch (e) {
          service.recordJob(
            u,
            "briefing",
            "Briefing job failed; retry manually",
            false,
          );
        }
      }
      db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
    } finally {
      running = false;
    }
  }
  const timer = setInterval(tick, 60000);
  timer.unref();
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      clearInterval(timer);
      app.close(() => {
        db.close();
        process.exit(0);
      });
    });
}
function joinPath(a, b) {
  return resolve(a, b);
}
