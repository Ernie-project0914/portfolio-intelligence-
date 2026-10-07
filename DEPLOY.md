# Publish the full app on Render

This deploys the React frontend, authenticated API, SQLite database and daily
briefing scheduler together. Render's Starter service and 1 GB persistent disk
are paid resources; review Render's current price before creating the service.
No hosting resources have been created by preparing these files.

1. Push this source to `Ernie-project0914/portfolio-intelligence-` on GitHub.
2. Sign in at https://dashboard.render.com/ and select **New → Blueprint**.
3. Connect GitHub and select that repository and the branch containing
   `render.yaml`. Render reads the deployment configuration automatically.
4. Review the plan and disk charges, then create the Blueprint.
5. Once the deployment is healthy, open the HTTPS URL shown on the web service.
   This is the actual app address, rather than a Codex workspace address.
6. For your private portfolio, open the service's Environment page and securely
   copy its generated `FOLIO_REGISTRATION_CODE` into **Settings → Create private
   account** in the app. Choose your own email and password. Never post this code
   or your credentials in chat.

The initial page is labeled demo data. Your private workspace starts empty.
This deploy does not upload existing local portfolio records or private files.
Use CSV for ledger records or follow the complete backup/restore procedure in
README.md if you need to move an existing database.

## Optional AI and market data

Add `FOLIO_AI_API_KEY` in Render's secure Environment page for AI interpretation.
Optionally add `FOLIO_MARKET_API_KEY` for Alpha Vantage prices. No Trading 212
access is needed. Save and redeploy after adding keys. Public news needs no key,
but its external provider may fail and must be verified on the deployed server.

The daily briefing runs after 08:00 Australia/Sydney by default while the service
is online. Notifications are in the app; email and push are not connected.

## Deployment checks

- Open `/api/health` on the service URL: expect `{"ok":true,"database":true}`.
- Confirm demo dashboard loads, then create the private owner account.
- Record a small deposit and check it persists after a service restart.
- Test news refresh and confirm any provider errors in the app.
- Keep one service instance: SQLite and its local persistent disk are designed
  for a single instance. Do not deploy this as a static site or an ephemeral
  serverless function.
- Run `npm run backup` in the service shell to create a consistent SQLite
  backup inside the persistent data directory. Store copies securely off-host.
