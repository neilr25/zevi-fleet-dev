# ZEVI Fleet Prototype

Interactive fleet-first dashboard for Smart Green Shipping's FastRig wind-assisted propulsion service.

## What it is

A single-page prototype showing:
- Global fleet view with status, alerts, and filters
- Ship-level drill-down with FastFix, FastReport, FastRegs, and FastRoute tabs
- Live AtoBviaC route calculation in the FastRoute tab
- Light / dark mode toggle

## Files

- `index.html` - the prototype
- `Logo_only.png` - SGS logo

## Run locally

```bash
python -m http.server 8088
```

Then open http://localhost:8088.

## Deployed on Vercel

See the live deployment URL from the Vercel dashboard.

## Notes

- The AtoBviaC API key is embedded in the frontend HTML for this prototype. For production, move API calls to a backend proxy.
- Route data is cached in the browser's localStorage for 7 days.
