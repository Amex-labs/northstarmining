# Northstar Mining Platform

Northstar Mining Platform is a responsive, trust-first crypto mining service demo built with a static frontend and a lightweight Node.js backend. It focuses on transparency, profitability education, and realistic market-dependent estimates rather than guaranteed returns.

## Included experience

- Premium public landing page with live operational stats
- Mining plans and ASIC marketplace with interactive profitability calculator
- User registration, login, and optional authenticator-based 2FA
- Logged-in dashboard with balances, contracts, earnings history, withdrawals, and notifications
- Real-time live stats and support chat over WebSockets
- Admin console for user management, earnings adjustments, support monitoring, and announcement broadcasts
- Local email preview outbox for operational notifications

## Run locally

From this folder:

```powershell
npm start
```

Then open the local app in your browser after the server starts.

## Access

- Use the standard registration flow from the website for general user access.
- Keep any seeded or operator credentials private and out of public documentation.

## Notes

- Earnings are estimates derived from simulated market data and operational assumptions.
- No guaranteed returns are shown anywhere in the app.
- Operational notification previews are written to `outbox/email`.
- Local development uses a file-backed store at `data/store.json`.
- If `DATABASE_URL` is set, the app stores account and dashboard data in Postgres instead.

## Deploy

### Render

This repo includes a [`render.yaml`](./render.yaml) blueprint that provisions both the web service and a Render Postgres database for persistent account storage.

Manual settings if you create the service in the dashboard:

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment variable: `TOKEN_SECRET` = any long random secret
- Environment variable: `DATABASE_URL` = your Render Postgres internal connection string

For an existing manual Render deploy:

1. Create a Render Postgres database in the same region as the web service.
2. Copy the database's internal connection string.
3. Add it to the web service as `DATABASE_URL`.
4. Redeploy the web service once.

After that, newly registered accounts, balances, withdrawals, and support history persist through restarts and spin-downs.

Important: Render's Free Postgres tier is suitable for testing, but not for long-term production retention. For a live service where registrations should remain valid indefinitely, use a paid Render Postgres plan such as `basic-256mb` or higher.

The app reads `PORT` from the environment, so it works with Render's assigned port automatically.

Important for Render free web services: local files are ephemeral and are lost on spin-down, restart, or redeploy. To keep registered accounts, balances, and support history, create a Render Postgres database and connect it through `DATABASE_URL`.
