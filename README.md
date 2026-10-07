# Folio — Personal Portfolio Intelligence

A private, read-only investment command centre built with React, TypeScript, Vite and a Node 24 / SQLite backend. **Manual entry is the primary workflow. Brokerage access is not required.** A separate demo workspace contains clearly labeled synthetic positions and history.

## Start and validate

For the free browser-only website, see [GitHub Pages website](WEBSITE.md).
For the optional server-backed hosted app, see [Publish on Render](DEPLOY.md).
The included Blueprint deploys the entire service with a persistent database.

Run these commands from `/workspace/portfolio-intelligence-`:

```sh
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run db:migrate
npm run dev -- --port 5173 --strictPort
```

`dev` starts both the local API (port 3001) and Vite. The API binds to loopback; Vite proxies `/api` while preserving the frontend origin. Dependencies and database files persist, but processes must restart after environment restoration. Do not create a worktree for cloud tasks unless explicitly requested.

```sh
npm run build
npm test
npm run test:browser
npm run backup
```

Browser tests use a separate temporary database and synthetic registration credentials. They never create your real owner account. Chromium is available in this cloud environment; outside it, install Playwright Chromium or set `PLAYWRIGHT_CHROMIUM_PATH`.

`npm start` serves the built frontend and API together. For deployment, put it behind an HTTPS reverse proxy, set `NODE_ENV=production` for Secure cookies and `FOLIO_PUBLIC_ORIGIN` to the exact HTTPS application origin. Keep the database on persistent encrypted storage and restrict access to the private owner. No public deployment is performed by this repository or by publishing the Codex environment.

## Your manual portfolio

1. Open Settings, choose **Create private account** and establish an email/password. Use the registration code in the server's private `.data/registration-code` file. The code is generated locally, is never logged, and permits one owner account. Do not share the code or credentials in chat.
2. In Transactions, record your account deposits, then buys with ticker, shares, price, date and fees. Record sells, dividends, withdrawals and fees as they occur. Accounts currently use **USD**; foreign-exchange conversion and multi-currency consolidation are not implemented.
3. Use CSV import for historical batches. Preview validates the entire batch before any write. Commit is atomic. Reimporting identical file content is idempotent; supplied `external_id` values also deduplicate across files. Conflicting external IDs fail rather than silently changing records.
4. In Settings, enter manual current prices and optional previous closes, or configure a real quote provider. A buy-in price is **not** silently used as a current market quote. Unpriced holdings suppress full valuations and allocation claims; absent previous closes suppress daily-return claims.
5. Click a holding for position details and research. Company name, sector, industry and geography can be entered manually; overrides remain isolated to your workspace.
6. Watchlists, alert rules, calendar events, settings, assistant reports and daily briefings persist in SQLite.

Template:

```csv
date,ticker,type,quantity,price,amount,fees,external_id
2026-01-01,,DEPOSIT,0,0,1000,0,deposit-1
2026-01-02,AAPL,BUY,2,180,0,1,buy-1
```

Quantities and prices support six decimal places; monetary ledger amounts and fees settle to cents. Cost basis uses **weighted average**, incorporates buy fees and allocates basis proportionally on partial sales. Oversales, invalid dates, negative/nonfinite numbers and unfunded purchases/withdrawals are rejected. This calculation does not implement country-specific tax lot rules, corporate actions or stock splits.

## Daily assistant and news

- **Calculated assistant:** Works without an AI key. It explains portfolio arithmetic, concentration, recorded P/L, recorded events and sourced recent headlines. Its reports are labeled CALCULATED, not AI generated. It does not guess causes of market movements.
- **AI interpretation:** Set `FOLIO_AI_API_KEY` securely on the server/environment to enable OpenAI. `FOLIO_AI_MODEL` defaults to `gpt-4.1-mini`. Facts are supplied separately by the backend; interpretation is structured into observations, scenarios, risks, catalysts, uncertainties and questions. Missing inputs must be acknowledged. AI responses remain interpretations and may require verification.
- **News:** Yahoo Finance RSS is fetched server-side for holdings and watchlist symbols, with original article links, publisher/feed source, publication timestamps and summaries. No news key is needed. Feed availability and coverage are controlled by the external provider. Failed requests preserve previously sourced articles and display job errors; headlines are never invented.
- **Daily briefing:** The server checks once per minute and generates one archived briefing per local date after the selected hour (default 08:00 Australia/Sydney). It fetches news, refreshes prices when configured, includes calculated contributors and adds optional AI interpretation. In-app notifications announce new briefings. Manual generation can refresh the same day's briefing. The server must remain running; a cloud snapshot is not an always-on scheduler. Email/push delivery is not connected.
- **Alerts:** Price, position-weight and portfolio-drop rules evaluate against available observations on updates and on a server interval. Missing/stale quotes cannot trigger price rules; unavailable previous closes cannot trigger portfolio-drop rules. Notifications are deduplicated until a condition clears. These are observation-based alerts, not continuous market monitoring.

Required network destinations: `feeds.finance.yahoo.com`, `finance.yahoo.com`; optional integrations additionally use `www.alphavantage.co` and `api.openai.com`. At the last live check, the environment proxy denied the RSS CONNECT request with HTTP 403. Allowed-domain additions and optional API-key requirements have been saved in the environment draft. **Live RSS retrieval and real AI responses are not yet verified in this environment.** Review/apply those settings, add your own AI key securely if desired, restart the application when bindings change, then retry News and Research.

## Optional market data and brokerage

`FOLIO_MARKET_API_KEY` enables Alpha Vantage quotes, stock history and fundamentals. Quotes are marked delayed or cached, with provider timestamps. Historical daily data and adjusted risk history depend on the provider plan and rate limits. Statistical risk needs at least 30 aligned adjusted daily observations plus SPY history; unavailable volatility, beta and correlation are never simulated. Manual prices are labeled MANUAL.

A Trading 212 GET-only adapter exists behind an optional collapsed connection panel. It is not needed for your manual workflow and is not connected. No broker credential requirement has been added. It has only transport-level fixture validation; live API/schema compatibility is unverified. If used in a future task, consult current official API documentation and keep the complete authorization header server-side. Broker balances/history remain separate from the USD manual ledger to avoid unsupported currency conversion or double-counting. There are no trading, order placement, transfer or withdrawal API methods.

## Performance and data integrity

Private charts use recorded, fully priced portfolio snapshots. Demo charts and their illustrative benchmark are synthetic and clearly labeled. Real benchmark comparison is not connected. Snapshot percentage returns assume cash flows occur at the observation-period end; exact time-weighted returns require valuations around every flow. Current-position risk uses fixed current weights and adjusted daily prices, not the user's historical position weights. Unrealised contribution uses net deposits as its denominator. Rolling realised P/L is available for today (workspace timezone), 7, 30 and 365 days; historical unrealised returns require dated prices.

Snapshots represent records and valuations known when captured. Import historical transactions atomically rather than treating partially entered setup records as a complete historical portfolio. Manual/cached quotes retain their observation timestamps; they do not become live prices simply because a new snapshot or briefing is generated.

## Backup and security

Settings exports an owner-scoped JSON archive containing accounts, transactions, quote observations, snapshots, watchlist, metadata, alerts, events, news, assistant reports and briefings. Treat exports as sensitive. Full automated JSON restoration is not implemented; CSV can restore ledger entries.

`npm run backup` uses SQLite's consistent backup API, writes a timestamped file under `.data/backups`, and restricts it to mode 0600. To restore a complete SQLite backup, stop the server, preserve the current database and WAL/SHM files, then replace `folio.sqlite` with the backup before restarting. Preserve the private registration-code file separately. Never replace a live database.

Credentials stay in server environment bindings; broker/API secrets are never returned to the frontend or stored in database records. Passwords use salted scrypt hashes. Sessions use random tokens, store only token hashes in SQLite, expire after seven days and use HttpOnly/SameSite cookies. JSON writes require an application header and matching origin. SQL values are parameterized and every financial record is scoped to its owner. Auth endpoints are rate limited. `.env`, `.data` and database files are ignored by Git. Local filesystem permissions protect the database directory; database encryption, account recovery, 2FA and a production secrets/operations system remain deployment work.

## Architecture

- `src/domain/`: frontend domain contracts and financial display helpers.
- `src/components/`: interactive charts, holdings, financial primitives, research, forms and connected screens.
- `src/api.ts`: same-origin API client and authenticated workspace loading.
- `server/migrations/`: versioned SQLite schema for User, BrokerAccount, Portfolio, Holding, Security, Transaction, PriceHistory, PortfolioSnapshot, Watchlist, Alert, NewsItem, ResearchReport, calendar, briefings and job state.
- `server/engine.mjs`: fixed-precision ledger validation and cost-basis calculations.
- `server/service.mjs`: owner-scoped persistence, imports, snapshots, alerts, grounded research and daily jobs.
- `server/providers/`: independent market, public-news, manual portfolio and read-only broker adapters.
- `server/index.mjs`: HTTP authentication, protected API routes, security headers and scheduler.
- `tests/`: ledger, persistence, isolation, HTTP security, RSS parsing, risk calculations and end-to-end desktop/mobile workflows.

The application remains functional without brokerage access, news availability or an AI key. It distinguishes functioning local capabilities from integrations awaiting access, credentials or provider-plan support.
