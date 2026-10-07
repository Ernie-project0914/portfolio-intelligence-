import { useReducedMotion } from "./useReducedMotion";
import { useState, useEffect, useId } from "react";
import {
  Area,
  Line,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Brush,
} from "recharts";
import { api } from "../api";
import { money } from "../domain/models";
interface Point {
  date: string;
  value: number;
  benchmark?: number;
  netFlow?: number;
}
interface History {
  note?: string;
  mode: string;
  synthetic: boolean;
  points: Point[];
}
export default function PortfolioChart({
  stock,
  revision,
}: {
  stock?: string;
  revision?: unknown;
}) {
  const reducedMotion = useReducedMotion();
  const fillId = useId().replaceAll(":", "");
  const [period, setPeriod] = useState("1Y"),
    [benchmark, setBenchmark] = useState(true),
    [metric, setMetric] = useState("Value"),
    [zoom, setZoom] = useState(false);
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setHistory(null);
    setError("");
    api<History>(
      stock
        ? `/security/${encodeURIComponent(stock)}/history?period=${period}`
        : `/history?period=${period}`,
    )
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [period, stock, revision]);
  const raw = history?.points || [];
  const first = raw[0]?.value || 0;
  let cumulative = 1;
  const data = raw.map((p, i) => {
    if (i && raw[i - 1].value > 0)
      cumulative *= Math.max(
        0,
        (p.value - ((p.netFlow ?? 0) - (raw[i - 1].netFlow ?? 0))) /
          raw[i - 1].value,
      );
    return {
      ...p,
      value:
        metric === "Return %"
          ? (cumulative - 1) * 100
          : metric === "Profit / loss"
            ? p.value - first - ((p.netFlow ?? 0) - (raw[0].netFlow ?? 0))
            : p.value,
      benchmark:
        p.benchmark === undefined
          ? undefined
          : metric === "Return %"
            ? first
              ? (p.benchmark / first - 1) * 100
              : 0
            : metric === "Profit / loss"
              ? p.benchmark - first
              : p.benchmark,
    };
  });
  const hasBenchmark = raw.some((p) => p.benchmark !== undefined);
  const periods = stock
    ? ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"]
    : ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "ALL"];
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>
            {stock ? `${stock} • price history` : "Portfolio performance"}
          </h2>
          <p>
            {stock ? "Security prices" : "Recorded portfolio valuations"}{" "}
            <span className="demo-inline">{history?.mode || "LOADING"}</span>
          </p>
        </div>
        <select
          aria-label="Chart metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {["Value", "Profit / loss", "Return %"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="chart-toolbar">
        <div className="periods">
          {periods.map((x) => (
            <button
              className={period === x ? "selected" : ""}
              key={x}
              onClick={() => setPeriod(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <button className="quiet" onClick={() => setZoom(!zoom)}>
          {zoom ? "Hide zoom" : "Zoom"}
        </button>
      </div>
      {error ? (
        <div className="chart-empty" role="status">
          <strong>History unavailable</strong>
          <p>{error}</p>
        </div>
      ) : !history ? (
        <div className="chart-empty" role="status">
          Loading history…
        </div>
      ) : data.length < 2 ? (
        <div className="chart-empty">
          <strong>More observations needed</strong>
          <p>
            {stock
              ? "The provider has fewer than two daily prices in the selected period. Intraday history is not configured."
              : "Record at least two fully priced portfolio snapshots to draw a performance chart. Incomplete valuations are excluded."}
          </p>
        </div>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ left: 0, right: 15, top: 15, bottom: 0 }}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#63ddac" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#63ddac" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#202b37"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-US", {
                    month: "short",
                    ...(period === "1D" ? { hour: "2-digit" } : {}),
                  })
                }
                minTickGap={60}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7c899b", fontSize: 11 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) =>
                  metric === "Return %"
                    ? `${v.toFixed(0)}%`
                    : stock
                      ? `$${Number(v).toFixed(0)}`
                      : `$${Math.round(v / 1000)}k`
                }
                axisLine={false}
                tickLine={false}
                width={58}
                tick={{ fill: "#7c899b", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#141d28",
                  border: "1px solid #354253",
                  borderRadius: 10,
                }}
                labelFormatter={(d) => new Date(String(d)).toLocaleString()}
                formatter={(v) =>
                  metric === "Return %"
                    ? `${Number(v).toFixed(2)}%`
                    : money(Number(v))
                }
              />
              <Area
                key={period + metric}
                type="monotone"
                dataKey="value"
                name={stock || "Portfolio"}
                stroke="#63ddac"
                strokeWidth={2.5}
                fill={`url(#${fillId})`}
                animationDuration={700}
                isAnimationActive={!reducedMotion}
              />
              {benchmark && hasBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  name="Illustrative benchmark"
                  stroke="#7084a2"
                  dot={false}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  isAnimationActive={!reducedMotion}
                />
              )}
              {zoom && (
                <Brush
                  dataKey="date"
                  height={20}
                  stroke="#52657b"
                  fill="#111923"
                  tickFormatter={(d) => new Date(d).toLocaleDateString()}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {history?.note && <p className="muted">{history.note}</p>}
      <div className="chart-footer">
        <span>
          <i className="dot mint" />
          {stock || "Your portfolio"}
        </span>
        {hasBenchmark && (
          <button className="quiet" onClick={() => setBenchmark(!benchmark)}>
            <i className="dot slate" />
            {benchmark ? "Hide" : "Show"} illustrative benchmark
          </button>
        )}
        <span className="muted">
          {history?.synthetic
            ? "Synthetic history • not actual returns"
            : stock
              ? "Provider observations • delayed"
              : "Snapshots • cash flows assumed at period end"}
        </span>
      </div>
    </section>
  );
}
