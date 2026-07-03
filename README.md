# ZEVI Fleet Prototype

Interactive fleet-first dashboard for Smart Green Shipping's FastRig wind-assisted propulsion service.

## What it is

A single-page prototype showing:
- Global fleet view with status, alerts, and filters
- Ship-level drill-down with FastFix, FastReport, FastRegs, and FastRoute tabs
- Real AtoBviaC illustrative routes, embedded as static data
- Ships positioned on their actual routes
- Light / dark mode toggle

## Files

- `index.html` - the prototype (loads fleet data from `/api/fleet` with static fallback)
- `index.static.html` - pure static fallback (no API dependency)
- `Logo_only.png` - SGS logo
- `data/fleet.json` - mocked fleet database (vessels + routes)
- `api/fleet.js` - Vercel function returning the fleet list
- `api/route.js` - Vercel function returning a route for a voyage
- `scripts/test-api.js` - local API smoke test
- `scripts/test-server.js` - local server that serves the HTML and API together
- `scripts/wire-frontend.js` - reference script for the frontend-to-API wiring
- `ROADMAP.md` - proposed evolution plan
- `USER_GUIDE.md` - how to use the dashboard

## Documentation

- See [`ROADMAP.md`](./ROADMAP.md) for the planned evolution.
- See [`USER_GUIDE.md`](./USER_GUIDE.md) for how to navigate the dashboard.

## Run locally

```bash
python -m http.server 8088
```

Then open http://localhost:8088.

To test the API and frontend together locally:

```bash
node scripts/test-server.js
```

Then open http://localhost:3000.

To test the API directly:

```bash
node scripts/test-api.js
```

## Deployed on Vercel

Production: https://zevi-fleet-prototype.vercel.app

Preview deployments from the `feature/api-backend` branch are available but currently require Vercel authentication to access. Merge to `main` to make them public.

## Notes

- The AtoBviaC API key is no longer embedded in the frontend HTML. Routes are stored as static AtoBviaC illustrative data in `data/fleet.json`.
- The dashboard now loads the vessel list from `/api/fleet` and falls back to the embedded static dataset if the API is unavailable.
- `index.static.html` is a pure static fallback that can be renamed to `index.html` for instant rollback.
- For production, replace the JSON file with a real database (Supabase/Postgres is the natural choice) and add a backend proxy to fetch fresh AtoBviaC routes on demand.
- Route data is cached in the browser's localStorage for 7 days (legacy behaviour kept for compatibility).
