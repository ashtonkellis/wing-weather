# wing-weather — Todo List

A PWA to aggregate weather data for wing foiling near **Alameda, CA**.
New feature requests go under **To Do**; finished ones move to **Done**.

## Project intent

Aggregate local weather — **tide height, wind speed, temperature** — for a
spot as close to Alameda as possible, and show at a glance whether
conditions are inside my rideable window (configurable min/max per metric).

### Data sources (verified free, no API key, browser/CORS-friendly)

- **Tide** — NOAA CO-OPS station `9414750` (Alameda). Hi/lo + 6-min
  interval predictions. `api.tidesandcurrents.noaa.gov`
- **Wind + temperature** — Open-Meteo forecast API at Alameda lat/lon.
  Current + hourly. Returns wind in knots. `api.open-meteo.com`

### Tech approach (proposed)

- Static PWA (plain HTML/CSS/JS, no build step) so GitHub Pages can serve
  it directly and auto-deploy is trivial. All API calls happen client-side.
- Thresholds + settings persisted in `localStorage`.

---

## To Do

### Epic 1 — Scaffolding, hosting & auto-deploy
- [ ] Scaffold static PWA structure (`index.html`, `css/`, `js/`, assets)
- [ ] Configure GitHub Pages for free hosting
- [ ] Add GitHub Actions workflow to auto-deploy on push to main

### Epic 2 — PWA installability (icon on phone)
- [ ] Add `manifest.webmanifest` (name, `display: standalone`, theme colors)
- [ ] Generate app icons (192px + 512px, maskable)
- [ ] Add a service worker to cache the app shell (installable + offline)
- [ ] Verify "Add to Home Screen" installs an icon on mobile

### Epic 3 — Fetch local weather data
- [ ] Fetch current tide height from NOAA (station 9414750)
- [ ] Fetch current wind speed from Open-Meteo (Alameda lat/lon)
- [ ] Fetch current temperature from Open-Meteo
- [ ] Aggregate into one data model with loading + error/retry states

### Epic 4 — Core UI + rideability thresholds
- [ ] Display current tide, wind, and temperature
- [ ] Show min/max rideable range per metric with an in-range indicator
- [ ] Settings screen to configure each min/max (persisted in `localStorage`)

### Epic 5 — Stretch: 3-hour predictions
- [ ] Predicted tide height over the next 3 hours (NOAA 6-min predictions)
- [ ] Predicted temperature over the next 3 hours (Open-Meteo hourly)
- [ ] Predicted wind speed over the next 3 hours (Open-Meteo hourly)

## Done

_Completed features will be listed here._
