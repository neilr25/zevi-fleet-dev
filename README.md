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
- `Logo_only.png` - SGS logo
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

## Deployed on Vercel

https://zevi-fleet-prototype.vercel.app

## Notes

- The AtoBviaC API key is no longer embedded in the frontend HTML. Routes are stored as static AtoBviaC illustrative data.
- For production, add a backend proxy to fetch fresh AtoBviaC routes on demand.
- Route data is cached in the browser's localStorage for 7 days (legacy behaviour kept for compatibility).
