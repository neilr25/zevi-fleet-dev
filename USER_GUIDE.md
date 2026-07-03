# Fast Fleet User Guide

A quick guide to the fleet-first dashboard prototype.

## Overview

Fast Fleet is a map-first dashboard for monitoring the Smart Green Shipping FastRig fleet. It shows where every vessel is, what status it is in, and lets you drill down into each ship’s performance, condition, compliance, contracts, and routes.

## Layout

### Left panel: fleet controls

The left panel is designed to stay visible without scrolling. It contains:

- **SGS logo and theme toggle** — switches between light and dark mode.
- **Status tiles** — click any tile to show or hide ships in that category. The count badge shows how many ships are currently in that category.
- **Filter by name** — type a ship name to narrow the map and the ship list.
- **Alert filters** — quickly surface ships that need attention (Critical, Attention, Route Update, Offline, No alert).
- **Fleet stats** — total ships, active FastRigs, and fleet savings.
- **Weather summary** — average wind, dominant wind direction, and weather alerts across the fleet.

### Main map

- **Ship markers** — each marker shows the vessel’s current position and heading.
- **Colours** — status is shown by the coloured ring:
  - Green = Nominal / No alert
  - Amber = Attention
  - Red = Critical / Maintenance
  - Cyan = Advice / Route Update
  - Blue = Prospect / At port
  - Grey = Offline / No data
- **Click a marker** — opens the right detail panel for that ship.
- **Select a ship** — all other ships are greyed out so the selected vessel stands out.

### Right panel: ship detail

Click a ship to open its detail panel. Tabs include:

- **Overview** — headline story, key threads, and quick actions.
- **Details** — object-model details: vessel, deployment, contract, voyage, performance, CII, CBM, and events.
- **FastFix** — maintenance board, work orders, parts, history, and certification.
- **FastReport** — payback, NPV, CO₂ avoided, and scenario comparison.
- **FastRegs** — CII rating, target trajectory, and regulator submission actions.
- **FastRoute** — current voyage route on the map, distance, ETA, speed, status, and route weather.

Click any section title or component row to drill deeper.

## FastRoute tab

The FastRoute tab shows the vessel’s current voyage as a real route line on the map.

- Routes are generated from AtoBviaC illustrative routes where the port pair is recognised.
- If a port pair is not recognised, a realistic voyage-based route is used.
- The ship marker is placed on the route, not alongside it.
- The panel shows distance, ETA, speed, status, and data trust.

## Filters

Filters work together with **AND** logic:

- A ship must match at least one selected status category.
- It must match its alert type (one of the selected alert filters).
- Its name must contain the text in the name filter (if any is typed).

## Light and dark mode

Use the moon/sun icon in the top bar to toggle themes. The map tiles also switch between a light and dark CartoDB style.

## Role switcher

The dropdown in the top bar lets you preview the dashboard as either a **Ship Owner** or **SGS Internal** user. In the future this will control which tabs, metrics, and actions are visible.

## Keyboard shortcuts

- `Esc` — close the ship panel.
- Click the map background — close the ship panel.

## Data notes

- Route data is cached in your browser for 7 days.
- Weather data is synthetic for this prototype.
- Provisional data is marked with an amber badge and is not admissible for invoicing or regulatory filings.
