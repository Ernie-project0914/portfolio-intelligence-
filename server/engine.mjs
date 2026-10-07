export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const roundRatio = (n, d) =>
  Number((BigInt(n) + BigInt(d) / 2n) / BigInt(d));
export const toUnits = (v, scale, label, max = 1e7) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max)
    throw new ValidationError(
      `${label} must be a finite number between 0 and ${max}`,
    );
  return Math.round(v * scale);
};
export function validateTransaction(raw) {
  if (!raw || typeof raw !== "object")
    throw new ValidationError("Transaction must be an object");
  const type = raw.type;
  if (
    !["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE"].includes(type)
  )
    throw new ValidationError("Unsupported transaction type");
  if (
    typeof raw.timestamp !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T.*Z)?$/.test(raw.timestamp) ||
    !Number.isFinite(Date.parse(raw.timestamp))
  )
    throw new ValidationError("Use an ISO date or UTC timestamp");
  const timestamp = new Date(raw.timestamp).toISOString();
  if (timestamp.slice(0, 10) !== raw.timestamp.slice(0, 10))
    throw new ValidationError("Invalid calendar date");
  if (timestamp > new Date().toISOString())
    throw new ValidationError("Future transactions are not allowed");
  const ticker = raw.ticker ? String(raw.ticker).trim().toUpperCase() : null;
  if (ticker && !/^[A-Z0-9][A-Z0-9.:-]{0,24}$/.test(ticker))
    throw new ValidationError("Invalid ticker");
  if (["BUY", "SELL", "DIVIDEND"].includes(type) && !ticker)
    throw new ValidationError("Ticker is required");
  const quantity = toUnits(raw.quantity ?? 0, 1e6, "Quantity", 1e6);
  const price = toUnits(raw.price ?? 0, 1e6, "Price");
  const fees = toUnits(raw.fees ?? 0, 100, "Fees");
  const amount = toUnits(raw.amount ?? 0, 100, "Amount");
  if (["BUY", "SELL"].includes(type) && (!quantity || !price))
    throw new ValidationError("Buy/sell requires positive quantity and price");
  if (!["BUY", "SELL"].includes(type) && (quantity || price))
    throw new ValidationError(
      "Cash transactions must have zero quantity and price",
    );
  if (!["BUY", "SELL"].includes(type) && !amount)
    throw new ValidationError("Cash transaction amount must be positive");
  if (type === "BUY" || type === "SELL") {
    const value = roundRatio(BigInt(quantity) * BigInt(price), 10000000000n);
    if (value > 1e11)
      throw new ValidationError("Trade value exceeds supported limit");
    if (type === "SELL" && fees > value)
      throw new ValidationError("Sale fees exceed proceeds");
  }
  if (!["BUY", "SELL"].includes(type) && ticker && type !== "DIVIDEND")
    throw new ValidationError("Ticker applies only to trades and dividends");
  return {
    type,
    timestamp,
    ticker,
    quantity_micros: quantity,
    price_micros: price,
    amount_cents: amount,
    fees_cents: fees,
  };
}
export function calculateLedger(transactions) {
  const events = [];
  const positions = new Map();
  let cash = 0,
    realised = 0,
    income = 0,
    fees = 0,
    netFlow = 0;
  for (const t of [...transactions].sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) ||
      (a.sequence ?? 0) - (b.sequence ?? 0),
  )) {
    const beforeRealised = realised,
      beforeIncome = income,
      beforeFees = fees;
    fees += t.fees_cents;
    const h = positions.get(t.ticker) || {
      ticker: t.ticker,
      quantity_micros: 0,
      basis_cents: 0,
      realised_cents: 0,
    };
    const value = roundRatio(
      BigInt(t.quantity_micros) * BigInt(t.price_micros),
      10000000000n,
    );
    if (t.type === "BUY") {
      h.quantity_micros += t.quantity_micros;
      h.basis_cents += value + t.fees_cents;
      cash -= value + t.fees_cents;
      positions.set(t.ticker, h);
    } else if (t.type === "SELL") {
      if (t.quantity_micros > h.quantity_micros)
        throw new ValidationError(
          `Sale exceeds ${t.ticker} shares held on ${t.timestamp}`,
        );
      const basis =
        t.quantity_micros === h.quantity_micros
          ? h.basis_cents
          : roundRatio(
              BigInt(h.basis_cents) * BigInt(t.quantity_micros),
              BigInt(h.quantity_micros),
            );
      const gain = value - t.fees_cents - basis;
      h.quantity_micros -= t.quantity_micros;
      h.basis_cents -= basis;
      h.realised_cents += gain;
      cash += value - t.fees_cents;
      realised += gain;
      positions.set(t.ticker, h);
    } else if (t.type === "DEPOSIT") {
      cash += t.amount_cents - t.fees_cents;
      netFlow += t.amount_cents;
    } else if (t.type === "WITHDRAWAL") {
      cash -= t.amount_cents + t.fees_cents;
      netFlow -= t.amount_cents;
    } else if (t.type === "DIVIDEND") {
      cash += t.amount_cents - t.fees_cents;
      income += t.amount_cents;
    } else if (t.type === "FEE") {
      cash -= t.amount_cents + t.fees_cents;
      fees += t.amount_cents;
    }
    events.push({
      timestamp: t.timestamp,
      type: t.type,
      realised: realised - beforeRealised,
      income: income - beforeIncome,
      fees: fees - beforeFees,
    });
    if (
      !Number.isSafeInteger(cash) ||
      !Number.isSafeInteger(h.quantity_micros) ||
      !Number.isSafeInteger(h.basis_cents)
    )
      throw new ValidationError("Ledger exceeds supported precision");
    if (cash < 0)
      throw new ValidationError(
        `Insufficient cash on ${t.timestamp}; import a deposit before purchases or withdrawals`,
      );
  }
  return {
    cash,
    realised,
    income,
    fees,
    netFlow,
    events,
    positions: [...positions.values()],
  };
}
export function parseCSV(text) {
  if (typeof text !== "string" || text.length > 1e6)
    throw new ValidationError("CSV must be smaller than 1 MB");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length)
        throw new ValidationError("Unexpected quote in CSV");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new ValidationError("Unterminated CSV quote");
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2)
    throw new ValidationError(
      "CSV needs a header and at least one transaction",
    );
  const headers = rows.shift().map((x) =>
    x
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase(),
  );
  const allowed = [
    "date",
    "ticker",
    "type",
    "quantity",
    "price",
    "amount",
    "fees",
    "external_id",
  ];
  if (
    new Set(headers).size !== headers.length ||
    headers.some((x) => !allowed.includes(x)) ||
    !["date", "type"].every((x) => headers.includes(x))
  )
    throw new ValidationError(
      "Headers: date,ticker,type,quantity,price,amount,fees,external_id (date and type required)",
    );
  if (rows.length > 1000)
    throw new ValidationError("Maximum 1000 transactions per import");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new ValidationError(`CSV row ${i + 2} has wrong column count`);
    const raw = Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
    for (const k of ["quantity", "price", "amount", "fees"]) {
      if (raw[k] && !/^\d+(\.\d+)?$/.test(raw[k]))
        throw new ValidationError(
          `CSV row ${i + 2}: ${k} must be a nonnegative decimal`,
        );
      raw[k] = Number(raw[k] || 0);
    }
    return { ...raw, timestamp: raw.date, type: raw.type.toUpperCase() };
  });
}
