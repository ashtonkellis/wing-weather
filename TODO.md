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

_Nothing queued — send a feature request and it'll show up here._

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

### Epic 7 — Full-day charts
- [x] Show the **entire day** (midnight→midnight) on every chart
- [x] Vertical **"now" marker** on each chart, with a legend chip
- [x] Overlay **gusts as a dotted line** on the wind chart (peak in legend)

### Epic 8 — Compact, phone-friendly layout
- [x] Compress vertically so it fits an iPhone with no scrolling
      (verified at 390×844, 375×812, and 375×667)
- [x] Respect the notch / Dynamic Island via `safe-area-inset` (nothing hidden)
- [x] Shade **nighttime** (before sunrise / after sunset) on every chart
- [x] Lower default min wind speed to **7 kn**
- [x] Cards **stretch to fill** the screen height (charts grow, no empty gap)

### Epic 9 — Wind direction
- [x] Show wind direction on the wind card (compass point it blows *from*,
      degrees, and an arrow pointing the way the wind travels)

### Epic 10 — Year-in-review rideability infographic
- [x] 📅 button opens a full-screen "year view" for the current location
- [x] Fetch a year of data: NOAA hourly tide predictions + Open-Meteo
      historical archive (past 12 months) for wind & temperature
- [x] Per day, compute daytime hours each parameter is rideable (uses the
      user's configured thresholds; daylight via Open-Meteo `is_day`)
- [x] Infographic: calendar heatmaps for tide, wind, temperature, and a
      combined "GO" (all three) view, with GO-day count and seasonal stats

### Epic 11 — Multiple selectable locations
- [x] Locations map in config (each: name, lat/lon, NOAA tide station);
      first location is `harbor-bay-club`
- [x] Active location resolved from `?loc=<slug>` URL param (else default)
- [x] In-app header picker to switch locations; updates the URL (shareable)
      and refetches the dashboard + year view for the new spot
- [x] First-run location picker; remembers the choice and auto-routes
      returning visitors to `?loc=<slug>`

### Epic 12 — Tap-to-inspect charts
- [x] Tap/drag a chart to show a cursor with the time (and value) at that
      point; wind also shows the gust value. Persists after release.

### Epic 14 — Multi-day forecast
- [x] Day-selector tabs (Today + next few days) at the top of the UI
- [x] Fetch several days at once (Open-Meteo forecast_days + NOAA multi-day
      tide) and switch days client-side with no refetch
- [x] Future days show each metric's day range + hours-rideable badge, the
      day's GO timeline, night shading, and no "now" marker; footer shows
      the date. Today keeps current values + now-marker.

### Epic 13 — GO / NO-GO banner
- [x] Banner atop the UI showing the current GO/NO-GO status and today's
      rideable window open/close timestamps (all three metrics in range,
      during daylight); "closes …" hint when a window is currently open.
- [x] Render it as a horizontal day timeline bar: green = GO, red = NO-GO,
      with a "now" marker and open/close time ticks.
- [x] Bar spans the full 24h (midnight→midnight); its left/right edges align
      with the charts underneath (banner matches the cards' geometry). Chip
      status derived from the timeline so it never contradicts the bar.
