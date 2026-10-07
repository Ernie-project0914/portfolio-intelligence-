import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateTransaction as v,
  calculateLedger,
  parseCSV,
} from "../server/engine.mjs";
const t = (type, rest) => v({ type, timestamp: "2025-01-01", ...rest });
test("weighted-average cost basis includes buy fees and prorates partial sales", () => {
  const l = calculateLedger([
    t("DEPOSIT", { amount: 1000 }),
    t("BUY", { ticker: "AAPL", quantity: 2, price: 100, fees: 2 }),
    t("SELL", { ticker: "AAPL", quantity: 1, price: 150, fees: 1 }),
  ]);
  assert.equal(l.cash, 94700);
  assert.equal(l.realised, 4800);
  assert.equal(l.positions[0].quantity_micros, 1e6);
  assert.equal(l.positions[0].basis_cents, 10100);
  assert.equal(l.fees, 300);
});
test("fractional shares and a complete sale reconcile exactly", () => {
  const l = calculateLedger([
    t("DEPOSIT", { amount: 100 }),
    t("BUY", { ticker: "AAPL", quantity: 0.125, price: 123.456, fees: 0.03 }),
    t("SELL", { ticker: "AAPL", quantity: 0.125, price: 125, fees: 0.02 }),
  ]);
  assert.equal(l.positions[0].quantity_micros, 0);
  assert.equal(l.positions[0].basis_cents, 0);
  assert.equal(l.cash - 10000, l.realised);
});
test("overselling, unfunded purchases and withdrawals are rejected", () => {
  assert.throws(
    () =>
      calculateLedger([t("BUY", { ticker: "AAPL", quantity: 1, price: 100 })]),
    /Insufficient cash/,
  );
  assert.throws(
    () =>
      calculateLedger([t("SELL", { ticker: "AAPL", quantity: 1, price: 100 })]),
    /exceeds/,
  );
  assert.throws(
    () =>
      calculateLedger([
        t("DEPOSIT", { amount: 10 }),
        t("WITHDRAWAL", { amount: 11 }),
      ]),
    /Insufficient cash/,
  );
});
test("dividends, cash flows and stand-alone fees stay separate from trade gains", () => {
  const l = calculateLedger([
    t("DEPOSIT", { amount: 100 }),
    t("DIVIDEND", { ticker: "AAPL", amount: 4, fees: 0.5 }),
    t("FEE", { amount: 1 }),
    t("WITHDRAWAL", { amount: 20 }),
  ]);
  assert.equal(l.cash, 8250);
  assert.equal(l.netFlow, 8000);
  assert.equal(l.income, 400);
  assert.equal(l.fees, 150);
  assert.equal(l.realised, 0);
});
test("invalid calendar dates, non-finite and negative financial inputs fail validation", () => {
  for (const raw of [
    { type: "BUY", ticker: "AAPL", quantity: -1, price: 1 },
    { type: "BUY", ticker: "AAPL", quantity: 1, price: Infinity },
    { type: "DEPOSIT", amount: 1, timestamp: "2025-02-30" },
    { type: "BUY", ticker: "<script>", quantity: 1, price: 1 },
  ])
    assert.throws(() => v({ timestamp: "2025-01-01", ...raw }));
});
test("CSV quoted fields and line endings parse; malformed rows do not", () => {
  const r = parseCSV(
    'date,type,amount,external_id\r\n2025-01-01,DEPOSIT,100,"external,id"\r\n',
  );
  assert.equal(r[0].external_id, "external,id");
  assert.equal(r[0].amount, 100);
  assert.throws(
    () => parseCSV("date,type,amount\n2025-01-01,DEPOSIT,NaN"),
    /nonnegative/,
  );
  assert.throws(() => parseCSV('date,type\n2025-01-01,"BUY'), /Unterminated/);
});
