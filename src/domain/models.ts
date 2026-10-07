export interface Security {
  ticker: string;
  name: string;
  sector: string;
  industry?: string;
  geography: string;
  color: string;
}
export interface Holding extends Security {
  priced?: boolean;
  dayChangeAvailable?: boolean;
  quoteMode?: string;
  quoteTimestamp?: string | null;
  shares: number;
  averageCost: number;
  price: number;
  dayChange: number;
}
export interface PricePoint {
  date: string;
  value: number;
  benchmark: number;
}
export interface MarketDataProvider {
  mode: "DEMO" | "REAL-TIME" | "DELAYED" | "CACHED";
  getHoldings(): Holding[];
  getHistory(period: string): PricePoint[];
}
export interface BrokerProvider {
  getAccounts(): Promise<{ id: string; name: string }[]>;
  getPositions(): Promise<Holding[]>;
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
export const valueOf = (h: Holding) => h.shares * h.price;
export const profitOf = (h: Holding) => h.shares * (h.price - h.averageCost);
