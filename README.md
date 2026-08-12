# wing-weather 🪁

A weather-aggregation **PWA** for wing foiling near **Alameda, CA**. It pulls
local **tide height**, **wind speed**, and **temperature** into a single
glanceable view and tells you whether conditions are inside your configurable
rideable window.

## Features

- 📲 **Installable PWA** — add it to your phone's home screen like a native app
- 🌊 **Tide height** near Alameda (NOAA CO-OPS station `9414750`)
- 💨 **Wind speed** and 🌡️ **temperature** at Alameda (Open-Meteo)
- ✅ **Rideability check** — configurable thresholds per metric (wind has a
  min/max window; tide and temperature are min-only), shown at a glance
- 🕒 **Rest-of-day outlook** — forecast for tide, wind, and temperature from
  now through today's **sunset** (dynamic, so shorter in winter)

## Data sources

All data is fetched client-side from free, no-key, CORS-friendly APIs:

| Metric | Source | Notes |
| --- | --- | --- |
| Tide | [NOAA CO-OPS](https://api.tidesandcurrents.noaa.gov/) | Station `9414750` (Alameda); hi/lo + 6-min predictions |
| Wind & temp | [Open-Meteo](https://open-meteo.com/) | Current + hourly forecast at Alameda lat/lon; wind in knots |

## Tech

Static PWA — plain HTML/CSS/JS, no build step — hosted free on **GitHub Pages**
and auto-deployed on every push. Settings persist in `localStorage`.

## Development

It's a static site, so just open `index.html` in a browser or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Roadmap

See [`TODO.md`](./TODO.md) for the feature backlog and progress.
