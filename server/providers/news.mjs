import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ValidationError } from "../engine.mjs";
const text = (value, max = 2000) =>
  String(typeof value === "object" ? value?.["#text"] || "" : value || "")
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
export function parseNewsFeed(xml, ticker) {
  if (
    typeof xml !== "string" ||
    xml.length > 2e6 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new ValidationError(
      "News provider returned invalid or oversized RSS",
      502,
    );
  const body = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: false,
  }).parse(xml);
  const items = body.rss?.channel?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items])
    .map((item) => {
      let url;
      try {
        url = new URL(text(item.link));
      } catch {
        return null;
      }
      const published = new Date(text(item.pubDate));
      const headline = text(item.title, 400);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !headline ||
        !Number.isFinite(published.getTime())
      )
        return null;
      return {
        headline,
        url: url.href,
        source: text(item.source, 100) || "Yahoo Finance feed",
        published_at: published.toISOString(),
        tickers: [ticker],
        summary: text(item.description, 1200),
      };
    })
    .filter(Boolean);
}
export class YahooRSSNewsProvider {
  constructor(transport = fetch) {
    this.transport = transport;
    this.name = "Yahoo Finance RSS";
  }
  async getNews(tickers) {
    const articles = [],
      errors = [];
    for (const ticker of tickers.slice(0, 10)) {
      const url = new URL("https://feeds.finance.yahoo.com/rss/2.0/headline");
      url.searchParams.set("s", ticker);
      url.searchParams.set("region", "US");
      url.searchParams.set("lang", "en-US");
      try {
        const response = await this.transport(url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new ValidationError(
            `News feed returned HTTP ${response.status}`,
            502,
          );
        const length = Number(response.headers?.get("content-length") || 0);
        if (length > 2e6) throw new ValidationError("News feed too large", 502);
        const reader = response.body?.getReader();
        let body = "";
        if (reader) {
          const decoder = new TextDecoder();
          let size = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 2e6) {
              await reader.cancel();
              throw new ValidationError("News feed too large", 502);
            }
            body += decoder.decode(value, { stream: true });
          }
          body += decoder.decode();
        } else body = await response.text();
        articles.push(...parseNewsFeed(body, ticker));
      } catch (e) {
        errors.push({
          ticker,
          message:
            e instanceof ValidationError
              ? e.message
              : "News feed could not be reached; check allowed domains in environment settings",
        });
      }
    }
    return { articles, errors, provider: this.name };
  }
}
