# Free website

This edition runs entirely in the browser and can be hosted free on GitHub Pages
for a public repository. No Render subscription is needed.

Enable it once in the repository's **Settings → Pages → Build and deployment**:
select **GitHub Actions**. The **Publish free website** workflow builds and deploys
the site on every main branch update; run it manually from Actions if necessary.
The deployment job shows the actual website URL when successful.

Expected address: https://ernie-project0914.github.io/portfolio-intelligence-/
This address is only live after Pages is enabled and deployment succeeds.

Record deposits before purchases in Transactions, then add current prices in
Settings. The ledger supports sells, dividends, fees, withdrawals and atomic CSV
imports. Watchlists, company details, events, alerts, calculations and briefings
are saved locally. Settings lets you view sample data without changing your
manual ledger, export a backup, or restore an export from this website edition.

**Storage is browser-only.** This is not an authenticated private account and is
not encrypted storage. People sharing this browser profile can see its records.
Clearing site data removes the portfolio; devices do not sync. Export backups.
No personal portfolio data or API keys are deployed to GitHub.

News opens current Yahoo Finance/Google News pages for your symbols. Headlines
are not fetched or summarized in this edition. The assistant explains recorded
portfolio arithmetic; it is not an AI model. Daily calculated briefings update
after the configured local hour while the website is open. Nothing runs while
the browser is closed. Live market feeds, secure AI calls, push notifications
and server scheduling remain features of the optional hosted backend edition.

Local website preview:

```sh
VITE_STATIC_SITE=true npm run build
npm run preview -- --port 5174
```

The full server-backed edition remains available via README.md and DEPLOY.md.
