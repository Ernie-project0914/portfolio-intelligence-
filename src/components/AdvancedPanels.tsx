import { useEffect, useState } from "react";
import {
  Plus,
  Upload,
  Download,
  ShieldCheck,
  RefreshCw,
  Star,
  X,
  Link,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { api, type PortfolioState } from "../api";
import { money, type Holding } from "../domain/models";
import { Company, Movement } from "./PortfolioUI";
interface Props {
  page: string;
  data: PortfolioState;
  reload: () => Promise<void>;
  onStock: (h: Holding) => void;
}
interface Article {
  id: string;
  headline: string;
  source: string;
  url: string;
  published_at: string;
  summary: string;
  tickers: string[];
}
interface Event {
  id: string;
  title: string;
  date: string;
  ticker: string | null;
  source_url: string | null;
  origin: string;
}
interface Briefing {
  localDate: string;
  generatedAt: string;
  mode: string;
  total: number | null;
  cash: number;
  daily: number | null;
  realised: number;
  unrealised: number | null;
  issues: string[];
  news: Article[];
  ai: Research | null;
}
interface Research {
  generatedBy?: string;
  timestamp: string;
  question: string;
  model: string;
  facts: { mode: string; complete: boolean; cash: number };
  interpretation: Record<string, string>;
  sources: { url: string; source: string; publishedAt: string }[];
}
interface Analytics {
  periodRealised: Record<string, number>;
  risk: {
    beta: number | null;
    volatility: number | null;
    observations: number;
    reason: string;
    correlations: { a: string; b: string; correlation: number | null }[];
  };
  realised: number;
  unrealised: number | null;
  income: number;
  fees: number;
  contributions: PortfolioState["contributions"];
  maxDrawdown: number | null;
  timeWeighted: number | null;
  volatility: null;
  method: string;
  snapshotCount: number;
}
export default function AdvancedPanels({ page, data, reload, onStock }: Props) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [research, setResearch] = useState<Research[]>([]),
    [analytics, setAnalytics] = useState<Analytics | null>(null),
    [briefings, setBriefings] = useState<Briefing[]>([]);
  const [account, setAccount] = useState(data.accounts[0]?.id || ""),
    [type, setType] = useState("BUY"),
    [ticker, setTicker] = useState(""),
    [quantity, setQuantity] = useState(""),
    [price, setPrice] = useState(""),
    [amount, setAmount] = useState(""),
    [fees, setFees] = useState("0"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [csv, setCSV] = useState(""),
    [preview, setPreview] = useState<{
      added: number;
      skipped: number;
      cash: number;
    } | null>(null);
  const [accountName, setAccountName] = useState("");
  const [alertKind, setAlertKind] = useState("PRICE_ABOVE"),
    [threshold, setThreshold] = useState("");
  const [eventTitle, setEventTitle] = useState(""),
    [eventDate, setEventDate] = useState(""),
    [eventSource, setEventSource] = useState("");
  const [question, setQuestion] = useState("Why did my portfolio move today?");
  const [brokerEnv, setBrokerEnv] = useState("demo");
  const [history, setHistory] = useState<Record<
    string,
    { items: unknown[]; complete: boolean }
  > | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [authMode, setAuthMode] = useState("login");
  const [timezone, setTimezone] = useState(data.settings.timezone),
    [refreshMinutes, setRefreshMinutes] = useState(
      String(data.settings.refreshMinutes),
    ),
    [notify, setNotify] = useState(data.settings.notifications),
    [dailyEnabled, setDailyEnabled] = useState(
      data.settings.dailyBriefing ?? true,
    ),
    [briefingHour, setBriefingHour] = useState(
      String(data.settings.briefingHour ?? 8),
    ),
    [useAI, setUseAI] = useState(false);
  const [manualPrice, setManualPrice] = useState(""),
    [previousClose, setPreviousClose] = useState("");
  async function loadExtras() {
    if (page === "Daily Briefing")
      setBriefings(await api<Briefing[]>("/briefings"));
    if (page === "News" || page === "Daily Briefing")
      setArticles(await api<Article[]>("/news"));
    if (page === "Calendar" || page === "Daily Briefing")
      setEvents(await api<Event[]>("/events"));
    if (page === "Research") setResearch(await api<Research[]>("/research"));
    if (page === "Performance" || page === "Risk")
      setAnalytics(await api<Analytics>("/analytics"));
  }
  useEffect(() => {
    setError("");
    setMessage("");
    setPreview(null);
    loadExtras().catch((e) => setError(e.message));
  }, [page, data.user.id]);
  async function run(fn: () => Promise<unknown>, success = "Saved") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      await reload();
      await loadExtras();
      setMessage(success);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    run(async () => {
      const payload = await api("/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `folio-${data.user.kind}-backup.json`;
      a.click();
      URL.revokeObjectURL(url);
    }, "Backup downloaded. Store it securely; it contains financial records.");
  }
  const transactionForm = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Add a transaction</h2>
          <p>
            USD accounts • weighted-average cost basis • deposits fund purchases
          </p>
        </div>
        <span className="demo-inline">
          {data.user.kind === "demo" ? "DEMO LEDGER" : "PRIVATE LEDGER"}
        </span>
      </div>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/transactions", "POST", {
                accountId: account,
                type,
                ticker: ["BUY", "SELL", "DIVIDEND"].includes(type)
                  ? ticker
                  : undefined,
                timestamp: date,
                quantity: ["BUY", "SELL"].includes(type) ? Number(quantity) : 0,
                price: ["BUY", "SELL"].includes(type) ? Number(price) : 0,
                amount: ["BUY", "SELL"].includes(type) ? 0 : Number(amount),
                fees: Number(fees),
              }),
            "Transaction recorded; holdings and cash recalculated",
          );
        }}
      >
        <label>
          Account
          <select
            aria-label="Transaction account"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setPreview(null);
            }}
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {["BUY", "SELL", "DIVIDEND", "DEPOSIT", "WITHDRAWAL", "FEE"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Date
          <input
            aria-label="Transaction date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {["BUY", "SELL", "DIVIDEND"].includes(type) && (
          <label>
            Ticker
            <input
              aria-label="Transaction ticker"
              required
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={25}
              placeholder="AAPL"
            />
          </label>
        )}
        {["BUY", "SELL"].includes(type) ? (
          <>
            <label>
              Shares
              <input
                aria-label="Transaction shares"
                type="number"
                step="0.000001"
                min="0.000001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              Price per share
              <input
                aria-label="Transaction price"
                type="number"
                step="0.000001"
                min="0.000001"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Amount (USD)
            <input
              aria-label="Transaction amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        <label>
          Fees (USD)
          <input
            aria-label="Transaction fees"
            type="number"
            step="0.01"
            min="0"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Plus size={14} />
          Record transaction
        </button>
      </form>
    </section>
  );
  const transactions = (
    <>
      <div className="metrics">
        {[
          ["Realised P/L", data.realised],
          ["Dividend income", data.income],
          ["Recorded fees", data.fees],
          ["Cash", data.cash],
        ].map(([l, v]) => (
          <section className="metric" key={String(l)}>
            <label>{l}</label>
            <strong>{money(Number(v))}</strong>
          </section>
        ))}
      </div>
      {transactionForm}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>CSV import</h2>
            <p>
              Preview first. Validated batches commit atomically; reimporting
              the same file is idempotent.
            </p>
          </div>
          <label className="secondary upload">
            <Upload size={14} />
            Choose CSV
            <input
              aria-label="Import CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 1e6) {
                    setError("CSV must be smaller than 1 MB");
                    return;
                  }
                  setCSV(await f.text());
                  setPreview(null);
                }
              }}
            />
          </label>
        </div>
        <p className="muted">
          Template: date,ticker,type,quantity,price,amount,fees,external_id.
          Optional external_id identifies transactions across exports. Deposit
          cash before buying. Select the target account above.
        </p>
        <textarea
          aria-label="CSV content"
          value={csv}
          onChange={(e) => {
            setCSV(e.target.value);
            setPreview(null);
          }}
          rows={5}
          placeholder={
            "date,ticker,type,quantity,price,amount,fees,external_id\n2026-01-01,,DEPOSIT,0,0,1000,0,deposit-1\n2026-01-02,AAPL,BUY,2,180,0,1,buy-1"
          }
        />
        <div className="action-row">
          <button
            disabled={busy || !csv}
            className="secondary"
            onClick={() =>
              run(async () => {
                const p = await api<{
                  added: number;
                  skipped: number;
                  cash: number;
                }>("/import", "POST", {
                  accountId: account,
                  csv,
                  commit: false,
                });
                setPreview(p);
              }, "Preview validated; no data has been changed")
            }
          >
            Validate preview
          </button>
          <button
            disabled={busy || !preview}
            className="primary"
            onClick={() =>
              run(async () => {
                await api("/import", "POST", {
                  accountId: account,
                  csv,
                  commit: true,
                });
                setPreview(null);
              }, "Import committed")
            }
          >
            Commit import
          </button>
          {preview && (
            <span className="muted">
              {preview.added} new • {preview.skipped} duplicates • resulting
              cash {money(preview.cash)}
            </span>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Transaction ledger</h2>
          <button className="quiet" onClick={exportData}>
            <Download size={14} />
            Export backup
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Date",
                  "Ticker",
                  "Type",
                  "Quantity",
                  "Price",
                  "Value",
                  "Fees",
                  "Account",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.transactions].reverse().map((t) => (
                <tr key={t.id}>
                  <td>{t.timestamp.slice(0, 10)}</td>
                  <td>{t.ticker || "—"}</td>
                  <td>{t.type}</td>
                  <td>{t.quantity_micros / 1e6 || "—"}</td>
                  <td>{t.price_micros ? money(t.price_micros / 1e6) : "—"}</td>
                  <td>
                    {money(
                      ["BUY", "SELL"].includes(t.type)
                        ? Math.round(
                            (t.quantity_micros * t.price_micros) / 1e10,
                          ) / 100
                        : t.amount_cents / 100,
                    )}
                  </td>
                  <td>{money(t.fees_cents / 100)}</td>
                  <td>{t.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.transactions.length && (
            <p className="empty">
              Start with a deposit, then record trades or import a CSV.
            </p>
          )}
        </div>
      </section>
    </>
  );
  const watchlist = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Your watchlist</h2>
          <p>Persisted in SQLite • quote freshness is shown separately</p>
        </div>
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => api("/watchlist", "POST", { ticker }),
              "Watchlist updated",
            );
          }}
        >
          <input
            aria-label="Watchlist ticker"
            placeholder="Ticker"
            required
            maxLength={25}
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
          <button className="secondary" disabled={busy}>
            <Plus size={14} />
            Add stock
          </button>
        </form>
      </div>
      {data.watchlist.map((s) => {
        const h = data.holdings.find((h) => h.ticker === s.ticker) || {
          ...s,
          price: s.price ?? 0,
          dayChange: s.dayChange ?? 0,
          shares: 0,
          averageCost: 0,
          priced: s.price !== null,
        };
        return (
          <div className="list-row" key={s.ticker}>
            <button
              className="quiet"
              onClick={() =>
                onStock(
                  h || {
                    ...s,
                    shares: 0,
                    averageCost: 0,
                    price: 0,
                    dayChange: 0,
                    priced: false,
                  },
                )
              }
            >
              <Company
                h={
                  h || {
                    ...s,
                    shares: 0,
                    averageCost: 0,
                    price: 0,
                    dayChange: 0,
                    priced: false,
                  }
                }
              />
            </button>
            <span>{h?.priced ? money(h.price) : "Quote unavailable"}</span>
            {h?.priced && <Movement value={h.dayChange} />}
            <button
              className="quiet"
              aria-label={`Remove ${s.ticker}`}
              onClick={() =>
                run(
                  () => api("/watchlist", "DELETE", { ticker: s.ticker }),
                  "Watchlist updated",
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      {!data.watchlist.length && (
        <p className="empty">Add a ticker to follow it.</p>
      )}
    </section>
  );
  const alertPanel = (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Monitored alert rules</h2>
            <p>
              Evaluated on refresh, ledger changes and once per minute while the
              server runs. No email or push delivery.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => api("/alerts/evaluate", "POST", {}),
                "Rules evaluated against available quotes",
              )
            }
          >
            Evaluate now
          </button>
        </div>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                api("/alerts", "POST", {
                  kind: alertKind,
                  ticker,
                  threshold: Number(threshold),
                }),
              "Rule saved and evaluated",
            );
          }}
        >
          <label>
            Condition
            <select
              aria-label="Alert condition"
              value={alertKind}
              onChange={(e) => setAlertKind(e.target.value)}
            >
              <option value="PRICE_ABOVE">Price above (USD)</option>
              <option value="PRICE_BELOW">Price below (USD)</option>
              <option value="WEIGHT_ABOVE">Position weight above (%)</option>
              <option value="PORTFOLIO_DROP">
                Portfolio daily drop above (%)
              </option>
            </select>
          </label>
          {alertKind !== "PORTFOLIO_DROP" && (
            <label>
              Ticker
              <input
                aria-label="Alert ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                required
              />
            </label>
          )}
          <label>
            Threshold
            <input
              aria-label="Alert threshold"
              type="number"
              step="0.01"
              min="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Save rule
          </button>
        </form>
        {data.alerts.map((a) => (
          <div className="list-row" key={a.id}>
            <span>
              {a.ticker || "Portfolio"} •{" "}
              {a.kind.toLowerCase().replaceAll("_", " ")} • {a.threshold}
            </span>
            <span className={a.state ? "positive" : "muted"}>
              {a.state ? "Triggered" : "Monitoring available data"}
            </span>
            <button
              className="quiet"
              aria-label="Remove alert"
              onClick={() =>
                run(() => api(`/alerts/${a.id}`, "DELETE", {}), "Rule removed")
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Notifications</h2>
          <button
            className="quiet"
            onClick={() =>
              run(() => api("/notifications/read", "POST", {}), "Marked read")
            }
          >
            Mark all read
          </button>
        </div>
        {data.notifications.map((n) => (
          <div className="list-row" key={n.id}>
            <span>{n.message}</span>
            <small className="muted">
              {new Date(n.created_at).toLocaleString("en-AU", {
                timeZone: data.settings.timezone,
              })}
              {n.read ? " • read" : " • new"}
            </small>
          </div>
        ))}
        {!data.notifications.length && (
          <p className="empty">
            No triggered rules. Missing quotes never trigger price alerts.
          </p>
        )}
      </section>
    </>
  );
  const calendar = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Portfolio calendar</h2>
          <p>
            Manually recorded events are labeled; provide a source for verified
            dates.
          </p>
        </div>
      </div>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              api("/events", "POST", {
                title: eventTitle,
                date: eventDate,
                ticker,
                sourceUrl: eventSource,
              }),
            "Event saved",
          );
        }}
      >
        <label>
          Title
          <input
            aria-label="Event title"
            required
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
          />
        </label>
        <label>
          Date
          <input
            aria-label="Event date"
            type="date"
            required
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </label>
        <label>
          Ticker (optional)
          <input
            aria-label="Event ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Source URL (optional)
          <input
            aria-label="Event source"
            type="url"
            value={eventSource}
            onChange={(e) => setEventSource(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <button className="primary" disabled={busy}>
          Add event
        </button>
      </form>
      {events.map((e) => (
        <div className="list-row" key={e.id}>
          <CalendarDays size={19} />
          <strong>{e.date}</strong>
          <span>
            {e.title} {e.ticker && `• ${e.ticker}`}
          </span>
          <span className="demo-inline">{e.origin}</span>
          {e.source_url && (
            <a
              href={e.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="quiet"
            >
              Source ↗
            </a>
          )}
          <button
            className="quiet"
            aria-label="Remove event"
            onClick={() =>
              run(() => api(`/events/${e.id}`, "DELETE", {}), "Event removed")
            }
          >
            <X size={15} />
          </button>
        </div>
      ))}
      {!events.length && (
        <p className="empty">
          No recorded events. Earnings and economic dates are never fabricated.
        </p>
      )}
    </section>
  );
  const news = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Portfolio news</h2>
          <p>
            Public Yahoo Finance RSS for your holdings and watchlist • no news
            API key required
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api<{
                added: number;
                errors: { message: string }[];
              }>("/news/refresh", "POST", {});
              if (r.errors.length)
                throw new Error(
                  `${r.added} articles cached. ${r.errors.map((e) => e.message).join(" ")}`,
                );
            }, "Sourced RSS news refreshed")
          }
        >
          <RefreshCw size={14} />
          Fetch news
        </button>
      </div>
      {data.jobs.find((j) => j.job === "news") && (
        <p className="muted">
          Last attempt:{" "}
          {data.jobs.find((j) => j.job === "news")?.last_attempt || "Never"} •
          last successful retrieval:{" "}
          {data.jobs.find((j) => j.job === "news")?.last_success || "Never"}.{" "}
          {data.jobs.find((j) => j.job === "news")?.error}
        </p>
      )}
      {articles.map((a) => (
        <article className="news-article" key={a.id}>
          <div className="eyebrow">
            {a.source} •{" "}
            {new Date(a.published_at).toLocaleString("en-AU", {
              timeZone: data.settings.timezone,
            })}
          </div>
          <a href={a.url} target="_blank" rel="noopener noreferrer">
            <h3>{a.headline} ↗</h3>
          </a>
          <p className="muted">{a.summary}</p>
          <span className="demo-inline">{a.tickers.join(" · ")}</span>
        </article>
      ))}
      {!articles.length && (
        <p className="empty">
          No sourced articles available. No demonstration headlines are
          invented.
        </p>
      )}
    </section>
  );
  const connections = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Portfolio connections</h2>
          <p>
            Read-only integrations. No order placement, withdrawals or
            transfers.
          </p>
        </div>
        <span className="demo-badge">READ-ONLY</span>
      </div>
      <div className="connection">
        <ShieldCheck className="positive" />
        <div>
          <h3>Manual transaction provider</h3>
          <p>
            Active • {data.accounts.length} accounts • holdings derived from the
            transaction ledger
          </p>
        </div>
      </div>
      <form
        className="compact-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/accounts", "POST", { name: accountName });
            setAccountName("");
          }, "Account added");
        }}
      >
        <input
          aria-label="New account name"
          placeholder="Account name"
          required
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
        />
        <button className="secondary" disabled={busy}>
          Add manual account
        </button>
      </form>
      <details className="optional-broker">
        <summary>
          Optional Trading 212 adapter — not required for manual tracking
        </summary>
        <div className="connection">
          <Link />
          <div>
            <h3>Trading 212</h3>
            <p>
              {data.broker.configured
                ? "Server authorization configured"
                : "Not connected. Add FOLIO_T212_AUTHORIZATION securely in environment settings."}
            </p>
            <p>
              Use only account/portfolio/history read permissions. The adapter
              sends GET requests exclusively. Official API compatibility still
              requires validation with your account.
            </p>
          </div>
        </div>
        <div className="action-row">
          <select
            aria-label="Broker environment"
            value={brokerEnv}
            onChange={(e) => setBrokerEnv(e.target.value)}
          >
            <option value="demo">Trading 212 demo</option>
            <option value="live">Trading 212 live</option>
          </select>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(
                () => api("/broker/sync", "POST", { environment: brokerEnv }),
                "Read-only broker view synchronized",
              )
            }
          >
            Connect / sync read-only
          </button>
          <button
            className="secondary"
            disabled={busy || !data.broker.connection}
            onClick={() =>
              run(
                () => api("/broker/disconnect", "POST", {}),
                "Broker connection and cached view removed",
              )
            }
          >
            Disconnect
          </button>
          <button
            className="secondary"
            disabled={busy || !data.broker.connection}
            onClick={() =>
              run(
                async () =>
                  setHistory(await api("/broker/history", "POST", {})),
                "Broker history retrieved; no ledger entries were inferred",
              )
            }
          >
            Read broker history
          </button>
        </div>
        {data.broker.connection && (
          <div className="broker-data">
            <h3>Broker account • {data.broker.connection.environment}</h3>
            <p className="muted">
              Last synced{" "}
              {new Date(data.broker.connection.synced_at).toLocaleString()}.
              Account currency is retained; broker balances are not combined
              with the USD manual ledger.
            </p>
            <pre>
              {JSON.stringify(
                JSON.parse(data.broker.connection.balances_json),
                null,
                2,
              )}
            </pre>
            <h3>Read-only positions</h3>
            <pre>
              {JSON.stringify(
                JSON.parse(data.broker.connection.positions_json),
                null,
                2,
              )}
            </pre>
          </div>
        )}
        {history &&
          Object.entries(history).map(([kind, v]) => (
            <div className="list-row" key={kind}>
              <strong>{kind}</strong>
              <span>
                {v.items.length} records •{" "}
                {v.complete
                  ? "complete pagination"
                  : "partial history; pagination cap reached"}
              </span>
            </div>
          ))}
      </details>
      <div className="connection">
        <RefreshCw />
        <div>
          <h3>Market data</h3>
          <p>
            {data.market.configured
              ? "Alpha Vantage configured • delayed quotes"
              : "No real market feed configured. FOLIO_MARKET_API_KEY enables Alpha Vantage."}
          </p>
        </div>
      </div>
    </section>
  );
  const settings = (
    <>
      <section className="panel">
        <h2>Private workspace access</h2>
        <p className="muted">
          {data.user.kind === "demo"
            ? "You are in an isolated demo workspace. Create or sign in to your private account for real data."
            : "Signed in as " + data.user.email}
          . Server sessions use HttpOnly cookies; passwords are hashed with
          scrypt.
        </p>
        <div className="action-row">
          <button
            className="secondary"
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login"
              ? "Create private account"
              : "Use existing account"}
          </button>
          {data.user.kind === "private" && (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  await api("/auth/logout", "POST", {});
                  await api("/auth/demo", "POST", {});
                }, "Signed out; a new isolated demo workspace is active")
              }
            >
              Sign out
            </button>
          )}
        </div>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/auth/${authMode}`, "POST", { email, password, code });
              setPassword("");
              setCode("");
            }, "Private workspace opened");
          }}
        >
          <label>
            Email
            <input
              aria-label="Account email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              aria-label="Account password"
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                authMode === "register" ? "new-password" : "current-password"
              }
            />
          </label>
          {authMode === "register" && (
            <label>
              Registration code
              <input
                aria-label="Registration code"
                type="password"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {authMode === "register" ? "Create private workspace" : "Sign in"}
          </button>
        </form>
        {authMode === "register" && (
          <p className="muted">
            Use the registration code from the server's private
            .data/registration-code file or FOLIO_REGISTRATION_CODE environment
            binding. Never send it in chat. One owner account is permitted.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Workspace settings</h2>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                api("/settings", "PATCH", {
                  timezone,
                  refreshMinutes: Number(refreshMinutes),
                  notifications: notify,
                  dailyBriefing: dailyEnabled,
                  briefingHour: Number(briefingHour),
                  currency: "USD",
                }),
              "Settings saved",
            );
          }}
        >
          <label>
            Currency
            <select aria-label="Display currency">
              <option>USD</option>
            </select>
          </label>
          <label>
            Timezone
            <input
              aria-label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            />
          </label>
          <label>
            Auto-refresh interval (minutes)
            <input
              aria-label="Refresh interval"
              type="number"
              min="5"
              max="1440"
              value={refreshMinutes}
              onChange={(e) => setRefreshMinutes(e.target.value)}
            />
          </label>
          <label>
            Daily briefing hour (local timezone)
            <input
              aria-label="Daily briefing hour"
              type="number"
              min="0"
              max="23"
              value={briefingHour}
              onChange={(e) => setBriefingHour(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={dailyEnabled}
              onChange={(e) => setDailyEnabled(e.target.checked)}
            />
            Daily briefing enabled
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            In-app notifications
          </label>
          <button className="primary" disabled={busy}>
            Save settings
          </button>
        </form>
        <p className="muted">
          Theme: Midnight. Auto-refresh runs while the browser is open and
          respects the selected interval. Quotes remain cached between
          refreshes. Foreign-exchange conversion is not configured.
        </p>
        <div className="action-row">
          <button className="secondary" onClick={exportData}>
            <Download size={14} />
            Export JSON
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => api("/snapshots", "POST", {}),
                "Snapshot recorded; incomplete valuations are excluded from performance charts",
              )
            }
          >
            Record snapshot
          </button>
        </div>
        <p className="muted">
          The JSON backup contains account records, ledger transactions,
          snapshots, preferences, news and research. Store it securely. SQLite
          files are protected by filesystem permissions; use encrypted storage
          for deployment. No broker credentials are stored in the database or
          frontend.
        </p>
      </section>
      {data.user.kind === "private" && (
        <section className="panel">
          <h2>Manual quote override</h2>
          <p className="muted">
            User-entered valuation is labeled MANUAL, never live. Add a price to
            value a holding while a provider is unavailable.
          </p>
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  api("/quotes", "POST", {
                    ticker,
                    price: Number(manualPrice),
                    previousClose: previousClose ? Number(previousClose) : null,
                  }),
                "Manual quote saved",
              );
            }}
          >
            <label>
              Ticker
              <input
                aria-label="Quote ticker"
                required
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Price (USD)
              <input
                aria-label="Manual price"
                required
                type="number"
                min="0.000001"
                step="0.000001"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
              />
            </label>
            <label>
              Previous close (optional)
              <input
                aria-label="Previous close"
                type="number"
                min="0.000001"
                step="0.000001"
                value={previousClose}
                onChange={(e) => setPreviousClose(e.target.value)}
              />
            </label>
            <button disabled={busy} className="primary">
              Save manual quote
            </button>
          </form>
        </section>
      )}
    </>
  );
  const ai = (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>
            <BrainCircuit size={17} /> Portfolio assistant
          </h2>
          <p>
            AI interpretation is separate from factual inputs. No trade
            execution or invented market data.
          </p>
        </div>
        <span className="demo-inline">
          {data.aiConfigured ? "AI CONFIGURED" : "PROVIDER REQUIRED"}
        </span>
      </div>
      <form
        className="alert-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => api(useAI ? "/research" : "/assistant", "POST", { question }),
            useAI
              ? "AI research report saved"
              : "Calculated portfolio explanation saved",
          );
        }}
      >
        <input
          aria-label="Research question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          maxLength={1000}
        />
        <button className="primary" disabled={busy}>
          Ask assistant
        </button>
      </form>
      <label className="checkbox-label assistant-switch">
        <input
          type="checkbox"
          checked={useAI}
          onChange={(e) => setUseAI(e.target.checked)}
        />
        Use AI interpretation (requires provider key)
      </label>
      {!data.aiConfigured && (
        <p className="muted">
          Configure FOLIO_AI_API_KEY securely in environment settings to use
          OpenAI. No simulated AI answers are presented.
        </p>
      )}
      {research.map((r, i) => (
        <article className="research-report" key={i}>
          <div className="eyebrow">
            {r.generatedBy === "CALCULATED"
              ? "CALCULATED EXPLANATION"
              : "AI INTERPRETATION"}{" "}
            • {r.model} • {new Date(r.timestamp).toLocaleString()}
          </div>
          <h3>{r.question}</h3>
          <section className="fact-box">
            <strong>FACTS • backend inputs</strong>
            <p>
              Quote mode: {r.facts.mode} • Cash: {money(r.facts.cash)} •
              Valuation {r.facts.complete ? "complete" : "incomplete"}
            </p>
          </section>
          {Object.entries(r.interpretation).map(([k, v]) => (
            <section key={k}>
              <h4>{k}</h4>
              <p className="muted">{v}</p>
            </section>
          ))}
          {r.sources.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {a.source} • {a.publishedAt} ↗
            </a>
          ))}
        </article>
      ))}
    </section>
  );
  const statisticalRisk = analytics && (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Statistical risk</h2>
          <p>
            Computed from aligned adjusted daily prices and SPY benchmark
            observations.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api<{
                updated: number;
                errors: { ticker: string; message: string }[];
              }>("/market/history", "POST", {});
              if (r.errors.length)
                throw new Error(
                  r.errors.map((e) => `${e.ticker}: ${e.message}`).join(" "),
                );
            }, "Adjusted histories loaded")
          }
        >
          Load adjusted histories
        </button>
      </div>
      <div className="summary-grid">
        <div>
          <small>Portfolio beta</small>
          <strong>
            {analytics.risk.beta === null
              ? "Unavailable"
              : analytics.risk.beta.toFixed(2)}
          </strong>
        </div>
        <div>
          <small>Annualized volatility</small>
          <strong>
            {analytics.risk.volatility === null
              ? "Unavailable"
              : `${analytics.risk.volatility.toFixed(2)}%`}
          </strong>
        </div>
        <div>
          <small>Aligned observations</small>
          <strong>{analytics.risk.observations}</strong>
        </div>
      </div>
      <p className="muted">
        {analytics.risk.reason} Adjusted history may require a paid provider
        plan.
      </p>
      {analytics.risk.correlations.map((c) => (
        <div className="list-row" key={c.a + c.b}>
          <strong>
            {c.a} / {c.b}
          </strong>
          <span>
            {c.correlation === null ? "Unavailable" : c.correlation.toFixed(3)}
          </span>
        </div>
      ))}
    </section>
  );
  const performance = analytics && (
    <section className="panel">
      <div className="panel-heading">
        <h2>Return attribution</h2>
        <span className="demo-inline">{data.market.mode}</span>
      </div>
      <div className="summary-grid">
        {[
          ["Realised", money(analytics.realised)],
          [
            "Unrealised",
            analytics.unrealised === null
              ? "Unavailable"
              : money(analytics.unrealised),
          ],
          ["Dividend income", money(analytics.income)],
          ["Recorded fees", money(analytics.fees)],
          [
            "Snapshot period return",
            analytics.timeWeighted === null
              ? "More snapshots required"
              : `${analytics.timeWeighted.toFixed(2)}%`,
          ],
          [
            "Max drawdown",
            analytics.maxDrawdown === null
              ? "More snapshots required"
              : `${analytics.maxDrawdown.toFixed(2)}%`,
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <h3>Realised P/L by rolling period</h3>
      <div className="summary-grid">
        {Object.entries(analytics.periodRealised).map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
      {analytics.contributions.map((c) => (
        <div className="list-row" key={c.ticker}>
          <strong>{c.ticker}</strong>
          <span>
            Unrealised:{" "}
            {c.unrealised === null ? "Unpriced" : money(c.unrealised)}
          </span>
          <span>Today: {c.day === null ? "Unavailable" : money(c.day)}</span>
          <span>
            Contribution:{" "}
            {c.contribution === null
              ? "Unavailable"
              : `${c.contribution.toFixed(2)}%`}
          </span>
        </div>
      ))}
      <p className="muted">
        Contribution uses cumulative net deposits as the denominator; this is
        not time-weighted attribution. {analytics.method}
      </p>
      <p className="muted">
        Daily, weekly, monthly and yearly realised results are derived from
        ledger transactions; historical unrealised P/L requires dated price
        observations.
      </p>
    </section>
  );
  const briefing = (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Daily follow-up</h2>
            <p>
              Scheduled at {data.settings.briefingHour ?? 8}:00 in{" "}
              {data.settings.timezone} while the server runs. Browser sessions
              are not required.
            </p>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(
                () => api("/briefings", "POST", {}),
                "Daily briefing generated and archived",
              )
            }
          >
            Generate daily briefing
          </button>
        </div>
        <p className="muted">
          The scheduler fetches sourced news, refreshes quotes when configured
          and adds AI interpretation when a key is present. It creates an in-app
          notification; email and push delivery are not connected.
        </p>
        {briefings.slice(0, 7).map((b) => (
          <article className="news-article" key={b.localDate}>
            <div className="eyebrow">
              {b.localDate} • {b.mode} • generated{" "}
              {new Date(b.generatedAt).toLocaleString("en-AU", {
                timeZone: data.settings.timezone,
              })}
            </div>
            <p>
              Portfolio: {b.total === null ? "Unpriced" : money(b.total)} •
              Cash: {money(b.cash)} • Daily movement:{" "}
              {b.daily === null ? "Unavailable" : money(b.daily)}
            </p>
            {b.issues.length > 0 && (
              <p className="negative">
                Refresh limitations: {b.issues.join("; ")}
              </p>
            )}
            {b.news.slice(0, 3).map((a) => (
              <p key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.headline} ↗
                </a>
              </p>
            ))}
            {b.ai && (
              <section className="fact-box">
                <strong>AI INTERPRETATION</strong>
                <p>{b.ai.interpretation["MARKET OBSERVATIONS"]}</p>
              </section>
            )}
          </article>
        ))}
        {!briefings.length && (
          <p className="muted">
            No archived daily briefings yet. Generate one now, or leave the
            server running for the scheduled briefing.
          </p>
        )}
      </section>
      <section className="panel briefing">
        <span className="eyebrow">{data.market.mode} • DAILY BRIEFING</span>
        <h2>Good morning.</h2>
        <p>
          {data.dailyComplete
            ? `Portfolio: ${money(data.total)}. Today's price movement: ${money(data.daily)}.`
            : "Your portfolio contains unpriced positions. A complete portfolio valuation is unavailable."}{" "}
          Realised P/L: {money(data.realised)}. Cash: {money(data.cash)}.
        </p>
        <p>
          Technology exposure:{" "}
          {data.complete
            ? `${data.risk.technology.toFixed(1)}%`
            : "Unavailable"}
          . Largest position:{" "}
          {data.risk.largest && data.complete
            ? `${data.risk.largest.ticker}, ${data.risk.largest.weight.toFixed(1)}%`
            : "Unavailable"}
          .
        </p>
      </section>
      <section className="panel">
        <h2>Daily contributors</h2>
        {[...data.contributions]
          .sort((a, b) => Math.abs(b.day || 0) - Math.abs(a.day || 0))
          .map((c) => (
            <div className="list-row" key={c.ticker}>
              <strong>{c.ticker}</strong>
              <span className={(c.day || 0) >= 0 ? "positive" : "negative"}>
                {c.day === null ? "Unavailable" : money(c.day)}
              </span>
            </div>
          ))}
      </section>
      <section className="panel">
        <h2>Upcoming recorded events</h2>
        {events
          .filter((e) => e.date >= new Date().toISOString().slice(0, 10))
          .slice(0, 5)
          .map((e) => (
            <div key={e.id} className="list-row">
              <strong>{e.date}</strong>
              <span>{e.title}</span>
              <span className="demo-inline">{e.origin}</span>
            </div>
          ))}
        {!events.length && <p className="muted">No recorded events.</p>}
        <h2>Latest sourced news</h2>
        {articles.slice(0, 3).map((a) => (
          <p key={a.id}>
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              {a.headline} ↗
            </a>
          </p>
        ))}
        {!articles.length && (
          <p className="muted">No sourced news available.</p>
        )}
      </section>
    </>
  );
  return (
    <div className="advanced-panels">
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          <CheckCircle2 size={15} />
          {message}
        </div>
      )}
      {busy && (
        <div role="status" className="muted loading-line">
          Working…
        </div>
      )}
      {page === "Transactions" && transactions}
      {page === "Watchlist" && watchlist}
      {page === "Alerts" && alertPanel}
      {page === "Calendar" && calendar}
      {page === "News" && news}
      {page === "Connections" && connections}
      {page === "Settings" && settings}
      {page === "Research" && ai}
      {page === "Performance" && performance}
      {page === "Risk" && statisticalRisk}
      {page === "Daily Briefing" && briefing}
    </div>
  );
}
