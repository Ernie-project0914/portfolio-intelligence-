import { Search, ArrowUpRight } from "lucide-react";
import { money, valueOf, profitOf, type Holding } from "../domain/models";
import { Company, Movement } from "./PortfolioUI";
interface Props {
  filtered: Holding[];
  total: number;
  search: string;
  setSearch: (value: string) => void;
  sector: string;
  setSector: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  sectors: string[];
  onSelect: (holding: Holding) => void;
  onViewAll: () => void;
}
export default function HoldingsTable({
  filtered,
  total,
  search,
  setSearch,
  sector,
  setSector,
  sort,
  setSort,
  sectors,
  onSelect,
  onViewAll,
}: Props) {
  return (
    <section className="panel holdings">
      <div className="panel-heading">
        <div>
          <h2>
            Your holdings <span className="count">{filtered.length}</span>
          </h2>
          <p>A closer look at what you own</p>
        </div>
        <button className="quiet" onClick={() => onViewAll()}>
          View all <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="table-controls">
        <label className="search">
          <Search size={15} />
          <input
            aria-label="Search holdings"
            placeholder="Search holdings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option>All sectors</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Sort holdings"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="value">Market value ↓</option>
          <option value="name">Company A–Z</option>
          <option value="return">Total return ↓</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Company",
                "Shares",
                "Avg. cost",
                "Price",
                "Market value",
                "Day change",
                "Total return",
                "Return %",
                "Weight",
              ].map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.ticker}
                onClick={() => {
                  onSelect(h);
                }}
              >
                <td>
                  <button
                    className="company-button"
                    aria-label={`Research ${h.ticker}`}
                  >
                    <Company h={h} />
                  </button>
                </td>
                <td>{h.shares}</td>
                <td>{money(h.averageCost)}</td>
                <td>
                  {h.priced !== false ? money(h.price) : "Unavailable"}
                  <small className="quote-status">
                    {h.quoteMode || "DEMO"}
                  </small>
                </td>
                <td className="bright">
                  {h.priced !== false ? money(valueOf(h)) : "—"}
                </td>
                <td>
                  {h.priced !== false && h.dayChangeAvailable !== false ? (
                    <Movement value={h.dayChange} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={profitOf(h) >= 0 ? "positive" : "negative"}>
                  {h.priced !== false
                    ? `${profitOf(h) >= 0 ? "+" : ""}${money(profitOf(h))}`
                    : "—"}
                </td>
                <td>
                  {h.priced !== false && h.averageCost > 0 ? (
                    <Movement value={(h.price / h.averageCost - 1) * 100} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="weight">
                    {h.priced !== false && total > 0
                      ? `${((valueOf(h) / total) * 100).toFixed(1)}%`
                      : "—"}
                    <span>
                      <i
                        style={{
                          width: `${total > 0 ? (valueOf(h) / total) * 200 : 0}%`,
                        }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="empty">No holdings match your search.</p>
        )}
      </div>
    </section>
  );
}
