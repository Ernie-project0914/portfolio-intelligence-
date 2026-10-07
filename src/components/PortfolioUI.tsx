import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Holding } from "../domain/models";
export const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export function Movement({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? "positive" : "negative"}>
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {signed(value)}
    </span>
  );
}
export function Company({ h }: { h: Holding }) {
  return (
    <div className="company">
      <span
        className="company-icon"
        style={{ color: h.color, background: h.color + "14" }}
      >
        {h.ticker.slice(0, 2)}
      </span>
      <div>
        <strong>{h.ticker}</strong>
        <small>{h.name}</small>
      </div>
    </div>
  );
}
