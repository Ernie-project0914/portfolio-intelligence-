import { test } from "node:test";
import assert from "node:assert/strict";
import { Trading212Provider } from "../server/providers/broker.mjs";
import { parseNewsFeed } from "../server/providers/news.mjs";
import { dailyRisk } from "../server/analytics.mjs";
test("broker adapter permits only GET account/history endpoints and rejects trade routes", async () => {
  const calls = [];
  const p = new Trading212Provider(
    "test-only-authorization",
    "demo",
    async (url, options) => {
      calls.push({ url: String(url), method: options.method });
      return {
        ok: true,
        json: async () =>
          String(url).includes("portfolio") ? [] : { currencyCode: "USD" },
      };
    },
  );
  await p.syncPortfolio();
  assert.ok(calls.every((c) => c.method === "GET"));
  assert.ok(
    calls.every((c) => c.url.startsWith("https://demo.trading212.com/api/v0/")),
  );
  await assert.rejects(p.get("equity/orders/market"), /allowlist/);
  assert.equal(calls.length, 3);
});
test("RSS keeps sourced date/link/ticker and rejects malformed or unsafe feeds", () => {
  const xml =
    "<rss><channel><item><title>Company announces results</title><link>https://example.com/results</link><pubDate>Tue, 06 Oct 2026 12:00:00 GMT</pubDate><description>Published summary</description></item><item><title>Unsafe</title><link>javascript:alert(1)</link><pubDate>Tue, 06 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>";
  const articles = parseNewsFeed(xml, "AAPL");
  assert.equal(articles.length, 1);
  assert.equal(articles[0].published_at, "2026-10-06T12:00:00.000Z");
  assert.deepEqual(articles[0].tickers, ["AAPL"]);
  assert.throws(
    () => parseNewsFeed('<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>', "AAPL"),
    /invalid/,
  );
});
test("risk metrics need aligned adjusted samples; identical weighted returns yield beta one", () => {
  assert.equal(dailyRisk({}, []).beta, null);
  const series = Array.from({ length: 65 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
    price: 100 * Math.exp(i * 0.001 + Math.sin(i) * 0.01),
  }));
  const r = dailyRisk({ AAPL: series, MSFT: series }, series, {
    AAPL: 0.5,
    MSFT: 0.5,
  });
  assert.ok(Math.abs(r.beta - 1) < 1e-10);
  assert.ok(r.volatility > 0);
  assert.ok(Math.abs(r.correlations[0].correlation - 1) < 1e-10);
  assert.equal(r.observations, 64);
});
