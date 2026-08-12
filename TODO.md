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

### Tech approach

- Static PWA (plain HTML/CSS/JS, no build step) so GitHub Pages can serve
  it directly and auto-deploy is trivial. All API calls happen client-side.
- Thresholds + settings persisted in `localStorage`.

---

## To Do

### Manual steps to go live (need repo owner)
- [ ] Enable GitHub Pages: repo **Settings → Pages → Source: GitHub Actions**
- [ ] Merge `claude/good-morning-xonl5b` → `main` to trigger the first deploy
- [ ] Install on phone from the live URL and confirm the home-screen icon

## Done

### Epic 1 — Scaffolding, hosting & auto-deploy
- [x] Scaffold static PWA structure (`index.html`, `css/`, `js/`, `icons/`)
- [x] GitHub Pages hosting (static site + `.nojekyll`)
- [x] GitHub Actions workflow to auto-deploy on push to `main`

### Epic 2 — PWA installability (icon on phone)
- [x] `manifest.webmanifest` (name, `display: standalone`, theme colors)
- [x] App icons (192px + 512px, `any maskable`)
- [x] Service worker caches the app shell (installable + offline)

### Epic 3 — Fetch local weather data
- [x] Current tide height from NOAA (station 9414750)
- [x] Current wind speed from Open-Meteo (Alameda lat/lon)
- [x] Current temperature from Open-Meteo
- [x] Aggregate into one data model with loading + error/retry states
      (tolerates a partial source failure)

### Epic 4 — Core UI + rideability thresholds
- [x] Display current tide, wind, and temperature
- [x] Min/max rideable range per metric with in-range indicator (green/red)
- [x] Settings screen to configure each min/max (persisted in `localStorage`)

### Epic 5 — Stretch: short-term predictions
- [x] Predicted tide height (NOAA 6-min predictions)
- [x] Predicted temperature (Open-Meteo hourly)
- [x] Predicted wind speed (Open-Meteo hourly)

### Epic 6 — Rest-of-day outlook
- [x] Extend forecasts from now through **today's sunset** (dynamic; from
      Open-Meteo `daily=sunset`, so shorter in winter)
- [x] Show the sunset time and each metric's day min–max on every card
- [x] Remove the upper limit for tide height (min only)
- [x] Remove the upper limit for temperature (min only)
