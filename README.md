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

- `index.html` - the prototype
- `index.static.html` - static-only fallback (no API dependency)
- `Logo_only.png` - SGS logo
- `data/fleet.json` - mocked fleet database (vessels + routes)
- `api/fleet.js` - Vercel function returning the fleet list
- `api/route.js` - Vercel function returning a route for a voyage
- `scripts/test-api.js` - local API smoke test
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

To test the API locally:

```bash
vercel dev
node scripts/test-api.js
```

## Deployed on Vercel

https://zevi-fleet-prototype.vercel.app

## Notes

- The AtoBviaC API key is no longer embedded in the frontend HTML. Routes are stored as static AtoBviaC illustrative data in `data/fleet.json`.
- A mocked data backend (`/api/fleet`, `/api/route`) is now available. The UI currently falls back to the embedded static dataset; wiring the API into the rendering layer is the next roadmap item.
- For production, replace the JSON file with a real database (Supabase/Postgres is the natural choice) and add a backend proxy to fetch fresh AtoBviaC routes on demand.
- Route data is cached in the browser's localStorage for 7 days (legacy behaviour kept for compatibility).
