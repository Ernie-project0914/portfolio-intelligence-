import { useState, useEffect } from "react";
import { api } from "../api";
import type { Holding } from "../domain/models";
export default function StockFacts({
  ticker,
  holding,
  reload,
}: {
  ticker: string;
  holding: Holding;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState(holding.name),
    [sector, setSector] = useState(holding.sector),
    [industry, setIndustry] = useState(holding.industry || "Unknown"),
    [geography, setGeography] = useState(holding.geography);
  const [facts, setFacts] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setFacts(null);
    setError("");
  }, [ticker]);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Company fundamentals</h2>
          <p>
            Source-stamped financial data is separate from AI interpretation.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setFacts(
                await api(
                  `/security/${encodeURIComponent(ticker)}/fundamentals`,
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading…" : "Load fundamentals"}
        </button>
      </div>
      <details className="optional-broker">
        <summary>Edit company details (manual metadata)</summary>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await api(
                `/security/${encodeURIComponent(ticker)}/metadata`,
                "PATCH",
                { name, sector, industry, geography },
              );
              await reload();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Company name
            <input
              aria-label="Company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Sector
            <input
              aria-label="Company sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
            />
          </label>
          <label>
            Industry
            <input
              aria-label="Company industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
            />
          </label>
          <label>
            Geography
            <input
              aria-label="Company geography"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              required
            />
          </label>
          <button className="primary">Save company details</button>
        </form>
        <p className="muted">
          Your entries remain isolated to this workspace and are labeled manual;
          they do not replace sourced provider facts.
        </p>
      </details>
      {error && (
        <p className="muted" role="status">
          {error}
        </p>
      )}
      {facts ? (
        <>
          <div className="summary-grid">
            {Object.entries(facts)
              .filter(
                ([k]) => !["timestamp", "source", "sourceLabel"].includes(k),
              )
              .map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v || "Unavailable"}</strong>
                </div>
              ))}
          </div>
          <p className="muted">
            Retrieved: {facts.timestamp} •{" "}
            <a href={facts.source} target="_blank" rel="noopener noreferrer">
              {facts.sourceLabel} ↗
            </a>
          </p>
        </>
      ) : (
        <p className="muted">
          No fundamentals loaded. A private workspace and configured market-data
          provider are required. Missing financial fields are never invented.
        </p>
      )}
    </section>
  );
}
