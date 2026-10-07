import { test } from "node:test";
import assert from "node:assert/strict";
import { cash, demoHoldings, demoProvider } from "../src/providers/demo.ts";
import { valueOf, profitOf } from "../src/domain/models.ts";
test("position values reconcile with cost basis and unrealised profit", () => {
  for (const h of demoHoldings) {
    assert.ok(
      Math.abs(valueOf(h) - h.shares * h.averageCost - profitOf(h)) < 1e-8,
    );
  }
  const total = demoHoldings.reduce((n, h) => n + valueOf(h), cash);
  assert.ok(total > cash);
  assert.equal(demoProvider.mode, "DEMO");
});
test("every chart period has ordered history ending at the current portfolio balance", () => {
  const total = demoHoldings.reduce((n, h) => n + valueOf(h), cash);
  for (const period of [
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "YTD",
    "1Y",
    "3Y",
    "5Y",
    "ALL",
  ]) {
    const data = demoProvider.getHistory(period);
    assert.equal(data.length, 65);
    assert.equal(data.at(-1)?.value, Math.round(total));
    assert.ok(
      data.every(
        (p, i) => Number.isFinite(p.value) && (!i || p.date > data[i - 1].date),
      ),
    );
  }
});
