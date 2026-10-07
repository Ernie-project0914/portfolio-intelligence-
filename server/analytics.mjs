export function dailyRisk(histories, benchmark, weights = {}) {
  const result = {
    volatility: null,
    beta: null,
    correlations: [],
    observations: 0,
    reason:
      "At least 30 aligned daily return observations are required. Manual quotes and demo data are excluded.",
  };
  const starts = new Map();
  const returns = (points, ticker) => {
    const map = new Map();
    const intervals = new Map();
    for (let i = 1; i < points.length; i++) {
      if (
        points[i - 1].price > 0 &&
        points[i].price > 0 &&
        Number.isFinite(points[i].price)
      ) {
        map.set(points[i].timestamp, points[i].price / points[i - 1].price - 1);
        intervals.set(points[i].timestamp, points[i - 1].timestamp);
      }
    }
    starts.set(ticker, intervals);
    return map;
  };
  const stocks = Object.entries(histories).map(([ticker, series]) => ({
    ticker,
    weight: weights[ticker] ?? 0,
    returns: returns(series, ticker),
  }));
  const bench = returns(benchmark, "benchmark");
  if (!stocks.length || bench.size < 30) return result;
  const dates = [...bench.keys()].filter((d) =>
    stocks.every(
      (s) =>
        s.returns.has(d) &&
        starts.get(s.ticker).get(d) === starts.get("benchmark").get(d),
    ),
  );
  if (dates.length < 30) return result;
  const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  const covariance = (x, y) => {
    const a = mean(x),
      b = mean(y);
    return x.reduce((s, v, i) => s + (v - a) * (y[i] - b), 0) / (x.length - 1);
  };
  const market = dates.map((d) => bench.get(d));
  const marketVariance = covariance(market, market);
  if (marketVariance <= 0) return result;
  const portfolio = dates.map((d) =>
    stocks.reduce((n, s) => n + s.returns.get(d) * s.weight, 0),
  );
  const variance = covariance(portfolio, portfolio);
  result.observations = dates.length;
  result.volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  result.beta = covariance(portfolio, market) / marketVariance;
  result.reason =
    "Annualized daily volatility (252 sessions), beta versus SPY. Weights held constant over the sample; this estimates current-position risk rather than historical portfolio risk.";
  for (let i = 0; i < stocks.length; i++)
    for (let j = i + 1; j < stocks.length; j++) {
      const x = dates.map((d) => stocks[i].returns.get(d)),
        y = dates.map((d) => stocks[j].returns.get(d));
      const d = Math.sqrt(covariance(x, x) * covariance(y, y));
      result.correlations.push({
        a: stocks[i].ticker,
        b: stocks[j].ticker,
        correlation: d ? covariance(x, y) / d : null,
      });
    }
  return result;
}
