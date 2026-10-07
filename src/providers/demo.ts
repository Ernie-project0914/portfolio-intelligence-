import type { Holding, MarketDataProvider } from "../domain/models";
export const demoHoldings: Holding[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology",
    geography: "United States",
    color: "#a3e635",
    shares: 220,
    averageCost: 98.5,
    price: 142.87,
    dayChange: 2.84,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    geography: "United States",
    color: "#cbd5e1",
    shares: 110,
    averageCost: 180,
    price: 228.26,
    dayChange: 0.76,
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    geography: "United States",
    color: "#60a5fa",
    shares: 48,
    averageCost: 330,
    price: 428.5,
    dayChange: 1.12,
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication",
    geography: "United States",
    color: "#fbbf24",
    shares: 90,
    averageCost: 135,
    price: 175.98,
    dayChange: 0.45,
  },
  {
    ticker: "AMZN",
    name: "Amazon.com Inc.",
    sector: "Consumer discretionary",
    geography: "United States",
    color: "#fb923c",
    shares: 70,
    averageCost: 145,
    price: 192.53,
    dayChange: -0.62,
  },
  {
    ticker: "V",
    name: "Visa Inc.",
    sector: "Financials",
    geography: "United States",
    color: "#a78bfa",
    shares: 40,
    averageCost: 240,
    price: 283.75,
    dayChange: 0.38,
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "Healthcare",
    geography: "United States",
    color: "#fb7185",
    shares: 45,
    averageCost: 162,
    price: 159.32,
    dayChange: -0.84,
  },
];
export const cash = 12480;
export const demoProvider: MarketDataProvider = {
  mode: "DEMO",
  getHoldings: () => demoHoldings,
  getHistory(period) {
    const days: Record<string, number> = {
      "1D": 1,
      "5D": 5,
      "1W": 7,
      "1M": 30,
      "3M": 90,
      "6M": 180,
      YTD: 279,
      "1Y": 365,
      "3Y": 1095,
      "5Y": 1825,
      ALL: 2200,
      MAX: 2200,
    };
    const span = days[period] || 365;
    const end = Date.UTC(2026, 9, 7);
    const total = demoHoldings.reduce((n, h) => n + h.price * h.shares, cash);
    return Array.from({ length: 65 }, (_, i) => {
      const t = i / 64;
      const growth = Math.min(0.42, span / 1100);
      const wave =
        (Math.sin(i * 0.63) * 0.012 + Math.cos(i * 0.21) * 0.018) * (1 - t);
      return {
        date: new Date(end - (1 - t) * span * 86400000).toISOString(),
        value: Math.round(total * (1 - growth + growth * t + wave)),
        benchmark: Math.round(total * (1 - growth + growth * t * 0.67)),
      };
    });
  },
};
export const manualBroker = {
  async getAccounts() {
    return [{ id: "demo", name: "Demo portfolio" }];
  },
  async getPositions() {
    return demoHoldings;
  },
};
