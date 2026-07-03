# ZEVI Fleet Prototype Roadmap

This document outlines a sensible evolution path for the `Fast Fleet` single-page prototype, from the current demo into a production-grade operations dashboard.

## Current state

- Single HTML file with Leaflet map, left control panel, and right ship-detail panel.
- Fleet-first view: status filters, alert filters, name search, fleet stats, weather summary.
- Ship drill-down with tabs: Overview, Details, FastFix, FastReport, FastRegs, FastRoute.
- Real AtoBviaC illustrative routes, embedded as static data, with ships positioned on the route.
- Light/dark mode toggle.

## Phase 1 — Hardening the demo (next 1–2 weeks)

### 1.1 Secure the AtoBviaC key
- Move the AtoBviaC API key out of the frontend HTML.
- Add a small serverless proxy (Vercel function) that calls AtoBviaC with the key stored in environment variables.
- Fallback to embedded static routes when the proxy is unavailable.

### 1.2 Tooltips and onboarding
- Add contextual tooltips to every interactive control in the left panel and ship panel.
- Add a one-time onboarding overlay for first-time visitors explaining the fleet-first layout.
- Create a short `USER_GUIDE.md`.

### 1.3 Responsive layout
- Collapse the left panel into a drawer on small screens.
- Make the right ship panel slide over the map instead of shrinking the viewport.
- Adjust marker sizes and font sizes for touch devices.

### 1.4 Error and loading states
- Show clear loading spinners while route/weather data is computed.
- Show friendly error messages when a route cannot be generated.
- Gracefully degrade if localStorage is unavailable.

## Phase 2 — Data realism (next 2–4 weeks)

### 2.1 Real vessel positions
- Integrate AIS or MyShipTracking API for live vessel positions.
- Cache positions and update them every 15–60 minutes instead of hardcoding them.
- Show "last updated" timestamp on each ship tooltip.

### 2.2 Dynamic routes
- Re-fetch AtoBviaC routes when a vessel's current voyage changes.
- Allow users to select alternate routes (e.g. via Cape of Good Hope vs. Suez).
- Compare predicted vs. actual route taken.

### 2.3 Weather layer
- Overlay real weather (wind, swell, current) from Open-Meteo or Copernicus on the map.
- Show weather along the planned route in the FastRoute tab.
- Highlight weather windows that are favourable for wind-assisted propulsion.

### 2.4 Verified vs. provisional data trust
- Visually distinguish verified data from provisional data in every metric.
- Show data lineage: source system, last sync, confidence score.

## Phase 3 — Operational workflows (next 1–3 months)

### 3.1 Role-based views
- Ship Owner view: contract, savings, invoices, guarantees.
- SGS Internal view: diagnostics, alerts, route advice, maintenance scheduling.
- Regulator view: CII, emissions reports, compliance timelines.
- Superintendent view: work orders, parts, certification.

### 3.2 Alerts and notifications
- Real-time alert feed (CBM, route, contract, data gap).
- Alert severity rules and routing to the right role.
- Acknowledge/escalate actions.

### 3.3 Export and reporting
- Export the current fleet view as PDF or PNG.
- Export ship reports as Excel with charts and route map.
- Generate draft FastRegs submissions.

### 3.4 Scenario planning
- "What-if" mode: add/remove FastRig units, change speed, adjust route.
- Compare fuel savings and payback across scenarios.
- Save and share scenarios.

## Phase 4 — Platform integration (3–6 months)

### 4.1 Backend and persistence
- Move from static HTML to a real frontend backed by the Pillar 2 data model.
- Supabase/PostgreSQL for ships, deployments, voyages, routes, events.
- Bronze/Silver/Gold data tiering as documented in the ZEVI object model.

### 4.2 Integration with FastRoute app
- Share route calculations between the fleet dashboard and the existing FastRoute Savings Analyser.
- Reuse the same weather analysis, polar data, and caching tables.

### 4.3 Authentication and audit
- Login, role selection, and audit trail.
- All route/weather decisions logged with user, timestamp, and input version.
- Support for single sign-on and multi-tenancy.

## Suggested priorities for the next sprint

1. Secure the AtoBviaC key behind a Vercel function.
2. Add tooltips and a first-time onboarding overlay.
3. Make the layout responsive for tablets and laptops.
4. Add a "last updated" timestamp and refresh control for route data.
