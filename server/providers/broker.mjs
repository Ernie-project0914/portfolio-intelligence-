import { ValidationError } from "../engine.mjs";
const READ_PATHS = new Set([
  "equity/account/info",
  "equity/account/cash",
  "equity/portfolio",
  "equity/history/orders",
  "equity/history/dividends",
  "equity/history/transactions",
]);
export class Trading212Provider {
  constructor(authorization, environment = "demo", transport = fetch) {
    this.authorization = authorization;
    this.environment = environment;
    this.transport = transport;
    this.base =
      environment === "live"
        ? "https://live.trading212.com/api/v0/"
        : "https://demo.trading212.com/api/v0/";
  }
  async get(path) {
    const relative = path.replace(/^\//, "");
    const p = relative.split("?")[0];
    if (!READ_PATHS.has(p))
      throw new ValidationError(
        "Broker route is not in the read-only allowlist",
      );
    let response;
    try {
      response = await this.transport(new URL(relative, this.base), {
        method: "GET",
        headers: { Authorization: this.authorization },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ValidationError("Trading 212 could not be reached", 502);
    }
    if (!response.ok)
      throw new ValidationError(
        `Trading 212 returned HTTP ${response.status}. Check API permissions and selected environment.`,
        response.status === 429 ? 429 : 502,
      );
    return response.json();
  }
  getAccounts() {
    return this.get("equity/account/info");
  }
  getPositions() {
    return this.get("equity/portfolio");
  }
  getBalances() {
    return this.get("equity/account/cash");
  }
  async getTransactions() {
    const outputs = {};
    for (const kind of ["orders", "dividends", "transactions"]) {
      let path = `equity/history/${kind}?limit=50`,
        items = [],
        complete = false;
      for (let page = 0; page < 10; page++) {
        const data = await this.get(path);
        if (!Array.isArray(data.items))
          throw new ValidationError(
            "Trading 212 history schema is unsupported",
            502,
          );
        items.push(...data.items);
        if (!data.nextPagePath) {
          complete = true;
          break;
        }
        const next = new URL(data.nextPagePath, this.base);
        if (
          next.origin !== new URL(this.base).origin ||
          !next.pathname.startsWith("/api/v0/")
        )
          throw new ValidationError("Unsupported broker pagination URL", 502);
        path = next.pathname.slice("/api/v0/".length) + next.search;
      }
      outputs[kind] = { items, complete };
    }
    return outputs;
  }
  async syncPortfolio() {
    const account = await this.getAccounts();
    const balances = await this.getBalances();
    const positions = await this.getPositions();
    if (!Array.isArray(positions))
      throw new ValidationError(
        "Trading 212 positions schema is unsupported",
        502,
      );
    return {
      account,
      balances,
      positions,
      syncedAt: new Date().toISOString(),
      provider: "Trading 212",
      environment: this.environment,
    };
  }
}
export class ManualPortfolioProvider {
  constructor(service, user) {
    this.service = service;
    this.user = user;
  }
  getAccounts() {
    return this.service.accounts(this.user);
  }
  getPositions() {
    return this.service.state(this.user).holdings;
  }
  getTransactions() {
    return this.service.transactions(this.user);
  }
  getBalances() {
    return { currency: "USD", cash: this.service.state(this.user).cash };
  }
  syncPortfolio() {
    return this.service.state(this.user);
  }
}
