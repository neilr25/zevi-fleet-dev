---
name: ZEVI Fleet Prototype Design System
description: Dark-first maritime operations dashboard. Codified from the existing index.html design tokens. All UI work MUST use these tokens, never ad-hoc values.
version: 1.0.0
modes: [dark, light]
fonts:
  sans: Inter
  mono: JetBrains Mono
---

# ZEVI Fleet Prototype Design System

Dark-first maritime operations UI with a full light-mode pair. Every color, radius, shadow, and font below already exists as a CSS variable in `index.html`. **Reference the variables, never hardcode hex values in component CSS.** Hex values are listed here only as the source-of-truth definition of each token.

## Principles

1. **Fleet-first, glanceable.** Dense data, no decoration that doesn't carry information.
2. **Numbers are monospace.** All metrics, savings, ROI, kW, tonnes use `JetBrains Mono`. Prose uses `Inter`.
3. **Trust is visible.** Verified vs provisional states must be distinguishable at a glance (badges, not just color).
4. **Both themes always.** Any new component must define values for dark and light mode via the CSS variables; never mode-locked values.
5. **Reuse surfaces.** Prefer extending an existing panel/modal pattern over inventing new chrome.

## Color tokens

### Dark mode (default, `:root`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B1120` | App background |
| `--surface` | `#151E32` | Cards, panels |
| `--elevated` | `#1E293B` | Raised elements, hover states |
| `--border` | `#2A3A55` | Default borders |
| `--border-light` | `#3B4D6E` | Emphasized borders |
| `--text` | `#F8FAFC` | Primary text |
| `--muted` | `#94A3B8` | Secondary text, labels |
| `--accent` | `#0EA5E9` | Primary action, links, KPI accent |
| `--accent-dark` | `#0284C7` | Accent hover/active |
| `--green` | `#10B981` | Savings, verified, good status |
| `--amber` | `#F59E0B` | Warnings, provisional |
| `--red` | `#EF4444` | Alerts, off-track |
| `--blue` | `#6366F1` | Prospect/info status |
| `--cyan` | `#06B6D4` | Advisory, live-advice status |

### Light mode (`[data-theme="light"]` or equivalent override)

| Token | Value |
|---|---|
| `--bg` | `#F8FAFC` |
| `--surface` | `#FFFFFF` |
| `--elevated` | `#F1F5F9` |
| `--border` | `#E2E8F0` |
| `--border-light` | `#CBD5E1` |
| `--text` | `#0F172A` |
| `--muted` | `#64748B` |
| `--accent` | `#0284C7` |
| `--accent-dark` | `#0369A1` |
| `--green` | `#059669` |
| `--amber` | `#D97706` |
| `--red` | `#DC2626` |
| `--blue` | `#4F46E5` |
| `--cyan` | `#0891B2` |

### Status pill tokens (both modes ship as triplets)

Each status has `{color, bg, border}`: `--status-green`, `--status-amber`, `--status-red`, `--status-blue`, `--status-cyan`, `--status-grey` with matching `-bg` (≈8–15% alpha) and `-border` (≈30–35% alpha) variants. Use the triplet, never a raw color on its own.

- `green` = on-track / verified
- `amber` = warning / under guarantee / provisional needing attention
- `red` = alert / fault
- `blue` = prospect (no deployment)
- `cyan` = live advice available
- `grey` = no data / unknown

### Weather tokens

`--weather-wind` (`#38BDF8` dark / `#0284C7` light), `--weather-wind-bg`, `--weather-rough`, `--weather-calm`, `--weather-alert`. Reserved for weather overlays and the route lens; do not repurpose.

## Typography

| Style | Font | Size | Weight | Use |
|---|---|---|---|---|
| Body | Inter | 13px | 400 | Base UI text |
| Label | Inter | 8–10px | 600–700, uppercase, 0.4–0.6px tracking | Section labels, KPI labels |
| Metric | JetBrains Mono | 14–18px | 700 | KPI values, savings, ROI |
| Metric small | JetBrains Mono | 10–12px | 600–700 | Table numbers, list values |

Rules: KPI values are always JetBrains Mono ≥14px bold. Labels are always uppercase Inter with letter-spacing. Never use mono for prose, never Inter for numbers.

## Shape & depth

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Small pills, badges |
| `--radius-md` | 6px | Buttons, inputs, small cards |
| `--radius-lg` | 8px | Panels, KPI cards, modals |
| `--radius-xl` | 10px | Large containers |
| `--shadow` | 2-layer drop shadow | Elevated cards, modals |

## Component patterns

- **KPI card:** `--surface`→`--bg` gradient, 3px gradient top border (`--accent`→`--green`→`--cyan`), icon + uppercase label + mono value ≥16px, hover lift `translateY(-2px)` with `--accent` border.
- **Status pill:** color/bg/border triplet, `--radius-sm`, uppercase 8–9px label.
- **Trust badge:** `verified` uses green triplet, `provisional` uses amber triplet, `nodata` uses grey. Always paired with its value.
- **Modal:** `--surface` background, `--radius-lg`, `--shadow`, overlay dims the app; closes completely (no persistent chrome left behind).
- **Primary button:** `--accent` background, white text, `--radius-md`, hover `--accent-dark`.
- **Ghost/action link:** `--accent` text, hover underline — used for "All vessels ›" style affordances.

## Do / Don't

- DO use CSS variables for every value.
- DO define both themes for anything new.
- DO keep ROI/savings values paired with a trust badge.
- DON'T add marketing-style pages, gated modules, or lead-capture UI.
- DON'T introduce new accent colors; the five status colors + accent are the complete palette.
- DON'T hardcode pixel values outside the spacing scale (4/6/8/10 radii, 8–18px type).
