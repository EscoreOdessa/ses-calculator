# SES Calculator — Power & Price Estimator

🇬🇧 English | [🇺🇦 Українська](README.uk.md)

A lightweight, static web tool that helps ESCORE sales managers give a client an instant, ballpark power and price estimate for a solar power station (SES) during the very first phone call — no engineer needed.

## What it does

The tool is organized into five tabs:

- **Калькулятор (Calculator)** — from a client's monthly electricity consumption (kWh), estimates daily / day / night consumption, target station power, the closest matching DEYE inverter, panel count, an indicative price, battery bank sizing for hybrid/autonomy setups, and mounting cost. Ends with a total price in USD and UAH.
- **Дані (Data)** — editable reference tables: inverter lineup, price-per-kW matrix (by station type / roof or ground / VAT / power), roof & mounting types, and the LV/HV battery catalogs. Edits are saved locally in the browser; Export/Import JSON lets you back up a data set or move it to another computer.
- **Розкладка панелей (Panel layout)** — search an address on a Google Map, trace the roof outline, and the tool auto-arranges the panel count computed on the Calculator tab (filling south-facing rows first, since they get the most sun). Save a clean, centered 2D PNG diagram to show the client.
- **Виробництво електроенергії (Energy production)** — estimated monthly/annual energy yield from the free PVGIS API (European Commission), using the same roof-tilt logic as the layout tool (snapped to the mounting angles actually available: 15° / 20° / 30°).
- **КП (Commercial proposal)** — generates a branded, printable commercial proposal (print → save as PDF) from the current calculation.

## Getting started

This is a static site: no build step, no server, no npm install.

1. Clone or download this repository.
2. Open `index.html` directly in a browser — it works straight from `file://`.

To share it with the whole team, host the folder anywhere that serves static files (GitHub Pages, any web host — see [Deployment](#deployment)).

## Configuration

Two one-time setup values live at the top of `panels.js`:

- **`MAPS_API_KEY`** — a Google Maps JavaScript API key (Maps JavaScript API + Geocoding API enabled), used by the "Panel layout" and "Energy production" tabs for address search and the map. Step-by-step setup: `Налаштування_Google_Cloud.md`.
- **`PVGIS_PROXIES`** — PVGIS (the free EU solar-irradiation service) doesn't send CORS headers, so browser requests need a small proxy in front of it. The array currently lists a few free public CORS proxies tried in order as a fallback chain. For a more reliable setup, deploy your own free Cloudflare Worker (code and instructions included: `pvgis-proxy-worker.js`, `Налаштування_PVGIS_Proxy.md`) and put its URL first in the list.

Both "Panel layout" and "Energy production" also share a small **localStorage cache** of PVGIS responses (30-day TTL) — recalculating the same address is instant and doesn't touch the network at all.

## Data & storage

Reference data (prices, inverters, batteries, roof types) ships with sensible defaults in `data.js`. Anything edited on the "Дані" tab is saved only in that browser's `localStorage` — it does **not** sync automatically between devices or users. Use the Export/Import JSON buttons on the "Дані" tab to move a customized data set between machines.

## Deployment

To publish on GitHub Pages:

1. Push this repository to GitHub.
2. In the repo's **Settings → Pages**, set the source to the `main` branch, root folder.
3. Share the resulting `https://<org>.github.io/<repo>/` URL with the sales team.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page shell and tab navigation |
| `style.css` | Styling |
| `data.js` | Default reference data (inverters, prices, roof types, batteries) |
| `calculator.js` | Pure calculation logic (power / price / battery sizing) |
| `storage.js` | localStorage persistence for edited reference data |
| `app.js` | "Калькулятор" tab wiring |
| `dani.js` | "Дані" tab (editable reference tables) |
| `geometry.js` | Panel-layout geometry (point-in-polygon, row sorting, tilt snapping) |
| `maps-loader.js` | Google Maps script loader |
| `panels.js` | "Розкладка панелей" tab + shared PVGIS fetch/cache helper |
| `production.js` | "Виробництво електроенергії" tab |
| `kp.js` | "КП" (commercial proposal) tab |
| `logo.js` | Base64-embedded company logo |
| `pvgis-proxy-worker.js` | Optional Cloudflare Worker source for a self-hosted PVGIS proxy |

## Company

Built for internal use by **ESCORE** — solar power station installer, Odesa, Ukraine.
