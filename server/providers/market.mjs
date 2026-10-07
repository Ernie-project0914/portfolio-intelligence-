import { ValidationError } from "../engine.mjs";
export class AlphaVantageProvider {
  constructor(key) {
    this.key = key;
    this.name = "Alpha Vantage";
    this.mode = "DELAYED";
  }
  async request(params) {
    const url = new URL("https://www.alphavantage.co/query");
    for (const [k, v] of Object.entries({ ...params, apikey: this.key }))
      url.searchParams.set(k, v);
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch {
      throw new ValidationError("Market provider could not be reached", 502);
    }
    if (!response.ok)
      throw new ValidationError(
        `Market provider returned HTTP ${response.status}`,
        502,
      );
    const body = await response.json();
    if (body.Note || body.Information)
      throw new ValidationError(
        "Market provider rate limit or plan restriction; cached data retained",
        429,
      );
    if (body["Error Message"])
      throw new ValidationError(
        "Market provider could not find this symbol",
        422,
      );
    return body;
  }
  async getQuote(ticker) {
    const body = await this.request({
      function: "GLOBAL_QUOTE",
      symbol: ticker,
    });
    const q = body["Global Quote"];
    const price = Number(q?.["05. price"]);
    const previousClose = Number(q?.["08. previous close"]);
    const day = q?.["07. latest trading day"];
    if (!(
      price > 0 &&
      previousClose > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(day || "")
    ))
      throw new ValidationError("Provider returned no usable quote", 502);
    return {
      ticker,
      price,
      previousClose,
      timestamp: `${day}T00:00:00.000Z`,
      mode: "DELAYED",
      provider: this.name,
    };
  }
  async getHistoricalPrices(ticker, adjusted = false) {
    const body = await this.request({
      function: adjusted ? "TIME_SERIES_DAILY_ADJUSTED" : "TIME_SERIES_DAILY",
      symbol: ticker,
      outputsize: "compact",
    });
    const series = body["Time Series (Daily)"];
    if (!series)
      throw new ValidationError(
        "Historical prices unavailable for this provider plan",
        422,
      );
    return Object.entries(series)
      .filter(
        ([d, p]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) &&
          Number(p[adjusted ? "5. adjusted close" : "4. close"]) > 0,
      )
      .map(([d, p]) => ({
        date: `${d}T00:00:00.000Z`,
        value: Number(p[adjusted ? "5. adjusted close" : "4. close"]),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async getCompanyProfile(ticker) {
    const b = await this.request({ function: "OVERVIEW", symbol: ticker });
    if (b.Symbol !== ticker)
      throw new ValidationError("Fundamentals unavailable", 422);
    return {
      name: b.Name,
      sector: b.Sector,
      industry: b.Industry,
      country: b.Country,
      marketCap: b.MarketCapitalization,
      pe: b.PERatio,
      forwardPe: b.ForwardPE,
      eps: b.EPS,
      revenue: b.RevenueTTM,
      revenueGrowth: b.QuarterlyRevenueGrowthYOY,
      profitMargin: b.ProfitMargin,
      dividendYield: b.DividendYield,
      beta: b.Beta,
      high52: b["52WeekHigh"],
      low52: b["52WeekLow"],
      timestamp: new Date().toISOString(),
      source: "https://www.alphavantage.co/",
      sourceLabel: this.name,
    };
  }
  async getFundamentals(ticker) {
    return this.getCompanyProfile(ticker);
  }
  async getMarketStatus() {
    return this.request({ function: "MARKET_STATUS" });
  }
  async getNews(tickers) {
    const body = await this.request({
      function: "NEWS_SENTIMENT",
      tickers: tickers.join(","),
      limit: "30",
    });
    return (body.feed || [])
      .filter((a) => a.title && a.url && a.time_published)
      .map((a) => ({
        headline: a.title,
        source: a.source,
        url: a.url,
        published_at: a.time_published.replace(
          /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
          "$1-$2-$3T$4:$5:$6Z",
        ),
        tickers: (a.ticker_sentiment || []).map((t) => t.ticker),
        summary: a.summary || "",
      }))
      .filter(
        (a) =>
          a.url.startsWith("https://") &&
          Number.isFinite(Date.parse(a.published_at)),
      );
  }
}
