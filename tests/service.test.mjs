import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.mjs";
import { PortfolioService } from "../server/service.mjs";
const setup = () => {
  const db = openDatabase(":memory:");
  const s = new PortfolioService(db, {
    registrationCode: "test-registration-code",
    env: {},
  });
  return { db, s };
};
test("demo ledger reconciles existing dashboard; user sessions and records are isolated", () => {
  const { db, s } = setup();
  try {
    const a = s.createDemo(),
      b = s.createDemo();
    const state = s.state(a);
    assert.equal(state.transactions.length, 8);
    assert.equal(state.total, 137422.7);
    assert.equal(state.cash, 12480);
    assert.equal(state.invested, 96500);
    const token = s.session(a);
    assert.equal(s.user(token).id, a.id);
    s.logout(token);
    assert.equal(s.user(token), null);
    assert.throws(
      () =>
        s.addTransactions(a, s.accounts(b)[0].id, [
          { type: "DEPOSIT", timestamp: "2025-01-01", amount: 10 },
        ]),
      /Account not found/,
    );
    s.watch(a, "TSLA");
    assert.ok(!s.state(b).watchlist.some((h) => h.ticker === "TSLA"));
  } finally {
    db.close();
  }
});
test("CSV preview is read-only, commit atomic and duplicates idempotent", () => {
  const { db, s } = setup();
  try {
    const u = s.createDemo(),
      id = s.accounts(u)[0].id;
    const csv =
      "date,ticker,type,quantity,price,amount,fees,external_id\n2025-02-01,,DEPOSIT,0,0,1000,0,d1\n2025-02-02,TSLA,BUY,2,200,0,1,b1";
    const p = s.importCSV(u, { csv, accountId: id, commit: false });
    assert.equal(p.added, 2);
    assert.equal(s.transactions(u).length, 8);
    s.importCSV(u, { csv, accountId: id, commit: true });
    assert.equal(s.transactions(u).length, 10);
    assert.equal(
      s.importCSV(u, { csv, accountId: id, commit: true }).skipped,
      2,
    );
    assert.equal(s.transactions(u).length, 10);
    assert.throws(
      () =>
        s.importCSV(u, {
          csv: csv.replace("2,200", "200,200"),
          accountId: id,
          commit: true,
        }),
      /conflicts/,
    );
    const invalid = csv
      .replace("d1", "d2")
      .replace("b1", "b2")
      .replace("2,200", "10000,200");
    assert.throws(
      () => s.importCSV(u, { csv: invalid, accountId: id, commit: true }),
      /Insufficient cash/,
    );
    assert.equal(s.transactions(u).length, 10);
  } finally {
    db.close();
  }
});
test("private owner requires registration code and starts empty without demo market prices", () => {
  const { db, s } = setup();
  try {
    assert.throws(
      () =>
        s.register({
          email: "owner@example.com",
          password: "a-long-test-password",
          code: "wrong",
        }),
      /registration/,
    );
    const u = s.register({
      email: "owner@example.com",
      password: "a-long-test-password",
      code: "test-registration-code",
    });
    assert.equal(s.state(u).holdings.length, 0);
    assert.equal(
      s.login({ email: "owner@example.com", password: "a-long-test-password" })
        .id,
      u.id,
    );
    assert.throws(
      () => s.login({ email: "owner@example.com", password: "incorrect" }),
      /Invalid/,
    );
    const account = s.accounts(u)[0].id;
    s.addTransactions(u, account, [
      { type: "DEPOSIT", timestamp: "2025-01-01", amount: 1000 },
      {
        type: "BUY",
        timestamp: "2025-01-02",
        ticker: "AAPL",
        quantity: 2,
        price: 100,
      },
    ]);
    const state = s.state(u);
    assert.equal(state.holdings[0].priced, false);
    assert.equal(state.complete, false);
    s.snapshot(u);
    assert.equal(s.history(u, "ALL").points.length, 0);
    assert.throws(
      () =>
        s.register({
          email: "second@example.com",
          password: "a-long-test-password",
          code: "test-registration-code",
        }),
      /owner/,
    );
  } finally {
    db.close();
  }
});
test("triggered alert notifications are deduplicated; missing quotes do not fire", () => {
  const { db, s } = setup();
  try {
    const u = s.createDemo();
    s.createAlert(u, { kind: "PRICE_ABOVE", ticker: "AAPL", threshold: 200 });
    assert.equal(s.state(u).notifications.length, 1);
    s.evaluateAlerts(u);
    assert.equal(s.state(u).notifications.length, 1);
    s.createAlert(u, { kind: "PRICE_BELOW", ticker: "TSLA", threshold: 1000 });
    assert.equal(s.state(u).notifications.length, 1);
  } finally {
    db.close();
  }
});
test("migrations and portfolio records survive a database restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "folio-test-"));
  let db = openDatabase(join(dir, "test.sqlite"));
  let s = new PortfolioService(db, { env: {} });
  const u = s.createDemo();
  s.watch(u, "TSLA");
  db.close();
  db = openDatabase(join(dir, "test.sqlite"));
  try {
    s = new PortfolioService(db, { env: {} });
    assert.equal(s.state(u).total, 137422.7);
    assert.ok(s.state(u).watchlist.some((h) => h.ticker === "TSLA"));
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,
      4,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("daily briefings are archived once per local date without duplicate notifications", async () => {
  const { db, s } = setup();
  try {
    const u = s.createDemo();
    const a = await s.dailyBriefing(u, { force: true, refresh: false }),
      b = await s.dailyBriefing(u, { force: true, refresh: false });
    assert.equal(a.localDate, b.localDate);
    assert.equal(s.briefings(u).length, 1);
    assert.equal(s.state(u).notifications.length, 1);
    assert.equal(a.mode, "DEMO");
    assert.equal(a.news.length, 0);
  } finally {
    db.close();
  }
});
test("calculated assistant grounds answers in portfolio arithmetic and abstains on news", () => {
  const { db, s } = setup();
  try {
    const u = s.createDemo();
    const r = s.assistant(u, {
      question: "How concentrated am I in technology?",
    });
    assert.match(r.answer, /56\.1/);
    assert.equal(r.generatedBy, "CALCULATED");
    assert.match(
      s.assistant(u, { question: "What is the latest news?" }).answer,
      /No sourced news/,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM research_reports").get().n,
      2,
    );
  } finally {
    db.close();
  }
});
test("manual metadata is isolated and absent previous close remains unknown", () => {
  const { db, s } = setup();
  try {
    const a = s.createDemo(),
      b = s.createDemo();
    s.securityMetadata(a, "AAPL", {
      name: "Apple",
      sector: "My category",
      industry: "Devices",
      geography: "USA",
    });
    assert.equal(
      s.state(a).holdings.find((h) => h.ticker === "AAPL").sector,
      "My category",
    );
    assert.equal(
      s.state(b).holdings.find((h) => h.ticker === "AAPL").sector,
      "Technology",
    );
    const u = s.register({
      email: "owner@example.com",
      password: "a-long-test-password",
      code: "test-registration-code",
    });
    s.addTransactions(u, s.accounts(u)[0].id, [
      { type: "DEPOSIT", timestamp: "2025-01-01", amount: 1000 },
      {
        type: "BUY",
        timestamp: "2025-01-02",
        ticker: "AAPL",
        quantity: 2,
        price: 100,
      },
    ]);
    db.prepare("INSERT INTO price_history VALUES(?,?,?,?,?,?)").run(
      "AAPL",
      new Date().toISOString(),
      90,
      null,
      "MANUAL",
      "User entry",
    );
    const state = s.state(u);
    assert.equal(state.complete, true);
    assert.equal(state.dailyComplete, false);
    assert.equal(state.profit, -20);
    assert.equal(state.contributions[0].day, null);
    s.createAlert(u, { kind: "PORTFOLIO_DROP", threshold: 1 });
    assert.equal(s.state(u).notifications.length, 0);
  } finally {
    db.close();
  }
});
