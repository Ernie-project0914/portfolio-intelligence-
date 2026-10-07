import { Company, Movement, signed } from "./components/PortfolioUI";
import HoldingsTable from "./components/HoldingsTable";
import { useState, useEffect } from "react";
import { api, usePortfolio, type PortfolioState } from "./api";
import StockFacts from "./components/StockFacts";
import AdvancedPanels from "./components/AdvancedPanels";
import {
  LayoutDashboard,
  Layers,
  ChartNoAxesCombined,
  Search,
  Star,
  Globe,
  Newspaper,
  CalendarDays,
  ShieldCheck,
  ArrowLeftRight,
  Bell,
  Link,
  Settings,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Menu,
  X,
  Command,
  RefreshCw,
  Sun,
  ChevronRight,
  Download,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import AnimatedValue from "./components/AnimatedValue";
import { useReducedMotion } from "./components/useReducedMotion";
import PortfolioChart from "./components/PortfolioChart";

import { money, valueOf, profitOf, type Holding } from "./domain/models";
const nav = [
  ["Overview", LayoutDashboard],
  ["Holdings", Layers],
  ["Performance", ChartNoAxesCombined],
  ["Research", Search],
  ["Watchlist", Star],
  ["Markets", Globe],
  ["News", Newspaper],
  ["Calendar", CalendarDays],
  ["Risk", ShieldCheck],
  ["Transactions", ArrowLeftRight],
  ["Alerts", Bell],
  ["Daily Briefing", Sun],
] as const;
export default function App() {
  const { data, error, reload } = usePortfolio();
  if (error)
    return (
      <main className="startup">
        <h1>Workspace unavailable</h1>
        <p role="alert">{error}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Retry connection
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="startup" role="status">
        <div className="skeleton" />
        <h1>Opening your workspace…</h1>
        <p>Connecting securely to your portfolio ledger.</p>
      </main>
    );
  return <Workspace key={data.user.id} data={data} reload={reload} />;
}
function Workspace({
  data,
  reload,
}: {
  data: PortfolioState;
  reload: () => Promise<void>;
}) {
  const demoHoldings = data.holdings;
  const { cash, total, invested, profit, daily } = data;
  const safePercent = (value: number, base: number) =>
    base ? (value / base) * 100 : 0;
  const reducedMotion = useReducedMotion();
  const [page, setPage] = useState("Overview");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [sort, setSort] = useState("value");
  const [allocationFilter, setAllocationFilter] = useState<{
    field: "ticker" | "industry" | "geography";
    value: string;
  } | null>(null);
  const [stock, setStock] = useState<Holding | null>(null);
  useEffect(() => {
    if (stock) {
      const latest = data.holdings.find((h) => h.ticker === stock.ticker);
      if (latest) setStock(latest);
    }
  }, [data]);
  const [allocation, setAllocation] = useState("Sector");
  const watch = data.watchlist.map((h) => h.ticker);
  const [notice, setNotice] = useState("");
  const alerts = data.alerts;
  const updated = data.market.lastUpdated
    ? new Date(data.market.lastUpdated).toLocaleString("en-AU", {
        timeZone: data.settings.timezone,
        timeZoneName: "short",
      })
    : "No quotes available";
  useEffect(() => {
    const poll = setInterval(() => {
      reload().catch(() =>
        setNotice("Connection interrupted; displayed data may be stale."),
      );
    }, 60000);
    let refresh: ReturnType<typeof setInterval> | undefined;
    if (data.user.kind === "private" && data.market.configured)
      refresh = setInterval(() => {
        api("/market/refresh", "POST", {})
          .then(() => reload())
          .catch((e) => setNotice(e.message));
      }, data.settings.refreshMinutes * 60000);
    return () => {
      clearInterval(poll);
      if (refresh) clearInterval(refresh);
    };
  }, [data.user.id, data.settings.refreshMinutes, data.market.configured]);
  function go(p: string) {
    setPage(p);
    setStock(null);
    setMenu(false);
    setSearch("");
    setSector("All sectors");
    setAllocationFilter(null);
  }
  async function toggleWatch(t: string) {
    try {
      await api("/watchlist", watch.includes(t) ? "DELETE" : "POST", {
        ticker: t,
      });
      await reload();
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const filtered = demoHoldings
    .filter(
      (h) =>
        (h.ticker + " " + h.name)
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (sector === "All sectors" || h.sector === sector) &&
        (!allocationFilter ||
          h[allocationFilter.field] === allocationFilter.value),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "return"
          ? profitOf(b) - profitOf(a)
          : valueOf(b) - valueOf(a),
    );
  const groups =
    allocation === "Stock"
      ? demoHoldings
          .map((h) => ({ name: h.ticker, value: valueOf(h), color: h.color }))
          .concat([{ name: "Cash", value: cash, color: "#657b9a" }])
      : allocation === "Geography"
        ? [...new Set(demoHoldings.map((h) => h.geography))]
            .map((name) => ({
              name,
              value: demoHoldings
                .filter((h) => h.geography === name)
                .reduce((n, h) => n + valueOf(h), 0),
              color: "#63ddac",
            }))
            .concat([{ name: "Cash", value: cash, color: "#657b9a" }])
        : allocation === "Cash"
          ? [
              { name: "Invested", value: total - cash, color: "#63ddac" },
              { name: "Cash", value: cash, color: "#657b9a" },
            ]
          : [
              ...new Set(
                demoHoldings.map((h) =>
                  allocation === "Industry"
                    ? h.industry || "Unknown"
                    : h.sector,
                ),
              ),
            ]
              .map((s, i) => ({
                name: s,
                value: demoHoldings
                  .filter(
                    (h) =>
                      (allocation === "Industry"
                        ? h.industry || "Unknown"
                        : h.sector) === s,
                  )
                  .reduce((n, h) => n + valueOf(h), 0),
                color: ["#63ddac", "#7895ec", "#c0a3f7", "#e9b66b", "#ed889c"][
                  i % 5
                ],
              }))
              .concat([{ name: "Cash", value: cash, color: "#657b9a" }]);
  const holdings = () => (
    <HoldingsTable
      filtered={filtered}
      total={total}
      search={search}
      setSearch={setSearch}
      sector={sector}
      setSector={setSector}
      sort={sort}
      setSort={setSort}
      sectors={[...new Set(demoHoldings.map((h) => h.sector))]}
      onViewAll={() => go("Holdings")}
      onSelect={(h) => {
        setStock(h);
        setPage("Research");
      }}
    />
  );
  function selectAllocation(name: string, value: number) {
    if (name === "Cash") {
      setNotice(
        `Available cash: ${money(value)}. Cash is tracked separately from equity holdings.`,
      );
      return;
    }
    setSector("All sectors");
    setAllocationFilter(null);
    if (allocation === "Sector") setSector(name);
    else if (allocation === "Industry")
      setAllocationFilter({ field: "industry", value: name });
    else if (allocation === "Geography")
      setAllocationFilter({ field: "geography", value: name });
    else if (allocation === "Stock")
      setAllocationFilter({ field: "ticker", value: name });
    setPage("Holdings");
  }
  function allocationCard() {
    if (!data.complete)
      return (
        <section className="panel allocation">
          <h2>Asset allocation</h2>
          <div className="chart-empty">
            <strong>Valuation incomplete</strong>
            <p>
              Add quotes for all holdings before assessing market-value
              allocation. Unpriced positions are not shown as zero-value assets.
            </p>
          </div>
        </section>
      );

    return (
      <section className="panel allocation">
        <div className="panel-heading">
          <div>
            <h2>Asset allocation</h2>
            <p>Balance across your portfolio</p>
          </div>
          <select
            aria-label="Allocation grouping"
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
          >
            {["Sector", "Industry", "Stock", "Geography", "Cash"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="donut">
          <ResponsiveContainer width="100%" height={205}>
            <PieChart>
              <Pie
                data={groups}
                dataKey="value"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={4}
                stroke="none"
                isAnimationActive={!reducedMotion}
                onClick={(d) => selectAllocation(d.name ?? "", d.value)}
              >
                {groups.map((g) => (
                  <Cell key={g.name} fill={g.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => money(Number(v))}
                contentStyle={{
                  background: "#151e29",
                  border: "1px solid #344254",
                  borderRadius: 10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <small>{allocation === "Sector" ? "SECTORS" : "ALLOCATION"}</small>
            <strong>{groups.length}</strong>
            <small>categories</small>
          </div>
        </div>
        <div className="allocation-list">
          {groups.map((g) => (
            <button
              key={g.name}
              onClick={() => selectAllocation(g.name, g.value)}
            >
              <span>
                <i className="dot" style={{ background: g.color }} />
                {g.name}
              </span>
              <strong>{safePercent(g.value, total).toFixed(1)}%</strong>
            </button>
          ))}
        </div>
      </section>
    );
  }
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          folio<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="avatar">E</span>
          <div>
            <strong>Personal portfolio</strong>
            <small>Private workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([p, Icon]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => go(p)}
            >
              <Icon size={18} />
              {p}
              {p === "Alerts" &&
                data.notifications.filter((n) => !n.read).length > 0 && (
                  <span className="nav-badge">
                    {data.notifications.filter((n) => !n.read).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade">
            <ShieldCheck size={20} />
            <strong>Your data. Your decisions.</strong>
            <p>
              Private intelligence.
              <br />
              Always in your control.
            </p>
            <span>
              <i className="dot mint" />
              Read-only by design
            </span>
          </div>
          {[
            ["Connections", Link],
            ["Settings", Settings],
          ].map(([p, Icon]: any) => (
            <button
              key={p}
              onClick={() => go(p)}
              className={page === p ? "active" : ""}
            >
              <Icon size={18} />
              {p}
            </button>
          ))}
          <div className="profile">
            <span className="avatar">EL</span>
            <div>
              <strong>Ernie</strong>
              <small>Personal account</small>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main">
        <header className="topbar">
          <button
            className="mobile-menu quiet"
            aria-label="Open menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{page}</strong>
          </span>
          <div className="top-actions">
            <span className="demo-badge">
              <i className="dot" />
              {data.user.kind === "demo" ? "DEMO DATA" : data.market.mode}
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => go("Alerts")}
            >
              <Bell size={18} />
            </button>
            <span className="avatar">EL</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR INVESTMENT COMMAND CENTRE</div>
              <h1>
                {stock
                  ? stock.name
                  : page === "Overview"
                    ? "Portfolio overview"
                    : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "The full picture. A clearer perspective."
                  : "Explore your portfolio with confidence."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    const result = await api<{
                      updated: number;
                      errors?: { message: string }[];
                      message?: string;
                    }>("/market/refresh", "POST", {});
                    await reload();
                    setNotice(
                      result.message ||
                        `Refreshed ${result.updated} quotes.${result.errors?.length ? " " + result.errors.map((e) => e.message).join(" ") : ""}`,
                    );
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button className="primary" onClick={() => go("Connections")}>
                <Plus size={16} />
                Add account
              </button>
            </div>
          </div>
          <div className="status-line">
            <span>
              <i className="dot mint" />
              {data.user.kind === "demo"
                ? "Demo workspace"
                : "Private workspace"}
            </span>
            <span>USD</span>
            <span>Last updated: {updated}</span>
            <span className="status-right">
              {data.user.kind === "demo"
                ? "Illustrative data • no live market feed"
                : data.complete
                  ? "Saved valuations • no trading execution"
                  : "Incomplete valuation • unpriced positions"}
            </span>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                className="quiet"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(page === "Overview" || page === "Performance") && (
            <>
              <div className="metrics">
                {[
                  [
                    "Total portfolio value",
                    data.complete ? money(total) : "Unpriced",
                    data.dailyComplete
                      ? `${daily >= 0 ? "+" : ""}${money(daily)} today`
                      : "Quote data required",
                    "hero",
                  ],
                  [
                    "Today’s return",
                    data.dailyComplete
                      ? `${daily >= 0 ? "+" : ""}${money(daily)}`
                      : "Unavailable",
                    data.dailyComplete
                      ? signed(safePercent(daily, total - daily))
                      : "Incomplete valuation",
                    "",
                  ],
                  [
                    "Total unrealised return",
                    data.complete
                      ? `${profit >= 0 ? "+" : ""}${money(profit)}`
                      : "Unavailable",
                    data.complete
                      ? signed(safePercent(profit, invested))
                      : "Incomplete valuation",
                    "",
                  ],
                  [
                    "Invested capital",
                    money(invested),
                    "Cost basis of current holdings",
                    "",
                  ],
                  [
                    "Available cash",
                    money(cash),
                    `${safePercent(cash, total).toFixed(1)}% of portfolio`,
                    "",
                  ],
                ].map(([label, value, sub, cls]) => (
                  <section key={label} className={"metric " + cls}>
                    <label>{label}</label>
                    <strong>
                      <AnimatedValue value={value} />
                    </strong>
                    <span
                      className={
                        label.includes("return") || cls
                          ? (label.includes("unrealised") ? profit : daily) >= 0
                            ? "positive"
                            : "negative"
                          : "muted"
                      }
                    >
                      {sub}
                    </span>
                    <span className="metric-decoration" />
                  </section>
                ))}
              </div>
              <div className="overview-grid">
                <PortfolioChart revision={data} />
                {allocationCard()}
              </div>
              {page === "Overview" && (
                <>
                  <div className="insight-strip">
                    <div className="insight-icon">
                      <Command size={20} />
                    </div>
                    <div>
                      <strong>A little perspective goes a long way.</strong>
                      <p>
                        {data.complete
                          ? `Technology makes up ${data.risk.technology.toFixed(1)}% of your portfolio. Review how this concentration aligns with your goals.`
                          : "Some positions are unpriced. Add manual quotes or configure a provider before assessing portfolio allocation."}
                      </p>
                    </div>
                    <button className="quiet" onClick={() => go("Risk")}>
                      Explore risk <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {holdings()}
                  <div className="bottom-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Today's movers</h2>
                        <span className="demo-inline">{data.market.mode}</span>
                      </div>
                      {demoHoldings
                        .filter((h) => h.priced && h.dayChangeAvailable)
                        .sort(
                          (a, b) =>
                            Math.abs(b.dayChange) - Math.abs(a.dayChange),
                        )
                        .slice(0, 3)
                        .map((h) => (
                          <button
                            className="list-row"
                            key={h.ticker}
                            onClick={() => {
                              setStock(h);
                              setPage("Research");
                            }}
                          >
                            <Company h={h} />
                            <Movement value={h.dayChange} />
                          </button>
                        ))}
                    </section>
                    <section className="panel briefing">
                      <span className="eyebrow">
                        <Sun size={15} /> DAILY PERSPECTIVE
                      </span>
                      <h2>
                        Stay informed.
                        <br />
                        Stay in control.
                      </h2>
                      <p>
                        See portfolio contributors, concentration and watchlist
                        movements in one concise briefing.
                      </p>
                      <button
                        className="quiet"
                        onClick={() => go("Daily Briefing")}
                      >
                        Open daily briefing <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          {page === "Holdings" && (
            <>
              {allocationFilter && (
                <div className="notice">
                  Filtered by {allocationFilter.field}: {allocationFilter.value}
                  <button
                    className="quiet"
                    onClick={() => setAllocationFilter(null)}
                  >
                    Clear filter
                  </button>
                </div>
              )}
              {holdings()}
            </>
          )}
          {page === "Research" &&
            (stock ? (
              <>
                <section className="panel stock-header">
                  <Company h={stock} />
                  <div>
                    <strong className="stock-price">
                      {stock.priced !== false
                        ? money(stock.price)
                        : "Unavailable"}
                    </strong>
                    {stock.priced !== false && (
                      <Movement value={stock.dayChange} />
                    )}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => toggleWatch(stock.ticker)}
                  >
                    <Star size={16} />
                    {watch.includes(stock.ticker)
                      ? "Remove from watchlist"
                      : "Add to watchlist"}
                  </button>
                </section>
                <div className="metrics">
                  {[
                    ["Shares", String(stock.shares)],
                    ["Average cost", money(stock.averageCost)],
                    [
                      "Position value",
                      stock.priced !== false
                        ? money(valueOf(stock))
                        : "Unavailable",
                    ],
                    [
                      "Unrealised P/L",
                      stock.priced !== false
                        ? money(profitOf(stock))
                        : "Unavailable",
                    ],
                    [
                      "Portfolio weight",
                      `${safePercent(valueOf(stock), total).toFixed(1)}%`,
                    ],
                  ].map(([l, v]) => (
                    <section className="metric" key={l}>
                      <label>{l}</label>
                      <strong>{v}</strong>
                    </section>
                  ))}
                </div>
                <StockFacts
                  key={stock.ticker}
                  ticker={stock.ticker}
                  holding={stock}
                  reload={reload}
                />
                <PortfolioChart stock={stock.ticker} revision={data} />
              </>
            ) : (
              <>
                <section className="panel">
                  <h2>Find your next question</h2>
                  <p className="muted">
                    Select a holding to explore your position. Real data
                    requires a configured provider.
                  </p>
                </section>
                {holdings()}
              </>
            ))}
          {page === "Risk" && (
            <>
              <div className="risk-banner">
                <ShieldCheck size={35} />
                <div>
                  <h2>Concentration deserves attention</h2>
                  <p>
                    Observations from available valuations, for your
                    consideration.
                  </p>
                </div>
                <span className="risk-pill">
                  {!data.complete
                    ? "VALUATION INCOMPLETE"
                    : data.risk.technology > 40 ||
                        (data.risk.largest?.weight || 0) > 20
                      ? "HIGH CONCENTRATION"
                      : "REVIEW EXPOSURES"}
                </span>
              </div>
              <div className="overview-grid">
                {allocationCard()}
                <section className="panel">
                  <h2>Portfolio observations</h2>
                  {[
                    [
                      "Largest position",
                      data.complete && data.risk.largest
                        ? `${data.risk.largest.ticker} • ${data.risk.largest.weight.toFixed(1)}%`
                        : "Unavailable",
                    ],
                    [
                      "Technology exposure",
                      data.complete
                        ? `${data.risk.technology.toFixed(1)}%`
                        : "Unavailable",
                    ],
                    [
                      "Geographic exposure",
                      [...new Set(demoHoldings.map((h) => h.geography))].join(
                        ", ",
                      ) || "No holdings",
                    ],
                    [
                      "Cash allocation",
                      `${safePercent(cash, total).toFixed(1)}%`,
                    ],
                    ["Beta / volatility", "Requires historical market data"],
                  ].map(([l, v]) => (
                    <div className="list-row" key={l}>
                      <span className="muted">{l}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                  <p className="muted">
                    A concentrated portfolio may respond strongly to a single
                    company, sector or region. Consider your time horizon and
                    capacity for drawdowns. No trade recommendations are
                    generated.
                  </p>
                </section>
              </div>
            </>
          )}
          {page === "Markets" && holdings()}
          <AdvancedPanels
            page={page}
            data={data}
            reload={reload}
            onStock={(h) => {
              setStock(h);
              setPage("Research");
            }}
          />
          <footer>
            <span>
              FOLIO <i /> Portfolio intelligence, with perspective.
            </span>
            <span>
              <ShieldCheck size={12} /> Read-only •{" "}
              {data.user.kind === "demo"
                ? "Demo environment"
                : "Private workspace"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
