# Northstar Mining Platform

Northstar Mining Platform is a responsive, trust-first crypto mining service demo built with a static frontend and a lightweight Node.js backend. It focuses on transparency, profitability education, and realistic market-dependent estimates rather than guaranteed returns.

## Included experience

- Premium public landing page with live operational stats
- Mining plans and ASIC marketplace with interactive profitability calculator
- User registration, login, email verification, and optional authenticator-based 2FA
- Logged-in dashboard with balances, contracts, earnings history, withdrawals, and notifications
- Real-time live stats and support chat over WebSockets
- Admin console for user management, earnings adjustments, support monitoring, and announcement broadcasts
- Local email preview outbox for verification and operational notifications

## Run locally

From this folder:

```powershell
npm start
```

Then open:

- [http://localhost:6060](http://localhost:6060)
- [http://localhost:6060/dashboard](http://localhost:6060/dashboard)
- [http://localhost:6060/admin](http://localhost:6060/admin)

## Seeded admin account

- email: `ops@northstar.demo`
- password: `Admin!2026`

## Preview user account

- email: `olivia.reid@northstar.demo`
- password: `Preview!2026`

## Notes

- Earnings are estimates derived from simulated market data and operational assumptions.
- No guaranteed returns are shown anywhere in the app.
- Verification and announcement emails are written to `outbox/email`.
- The data store is file-backed for demo purposes and lives at `data/store.json`.

## Deploy

### Render

This repo includes a [`render.yaml`](./render.yaml) blueprint for a simple web-service deploy.

Manual settings if you create the service in the dashboard:

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

The app reads `PORT` from the environment, so it works with Render's assigned port automatically.

Because runtime data is file-backed, a fresh deploy will seed demo data automatically if `data/store.json` does not exist.
