# ZEVI Fleet Prototype — Agent Context

Single-page fleet-first prototype for Smart Green Shipping's FastRig wind-assisted propulsion service. All app code lives in `app/`; repo root holds only documentation and git metadata.

## Key facts

- `app/index.html` is the whole frontend: map (Leaflet), left filter panel, right drill-down lenses, list view, demo wizards.
- `app/api/fleet.js` is the main endpoint; it computes vessel cards from `app/data/fleet.json` (Bronze/Silver/Gold tiers).
- `app/scripts/test-server.js` serves the app + API locally (`node app/scripts/test-server.js`).
- Dark mode is default; light mode must always be kept in sync.
- Deploy: `cd app && vercel --prod` (the `.vercel` project link lives in `app/`).

## Design Systems

- If a `DESIGN.md` file exists in the project root, you MUST follow its design tokens and principles for all UI generation tasks.
- Prefer design tokens over ad-hoc values. Reference exact hex codes, typography scales, and spacing values from DESIGN.md.
- All new components must define both dark and light theme values via the existing CSS variables.

## Guardrails

- No marketing pages, gated modules, or lead-capture UI — this is an operations prototype, not a sales site.
- Every number shown must be computed by the API from `data/fleet.json`, never hardcoded in the frontend.
- Provisional vs verified trust states must always be visible on calculated outputs.
