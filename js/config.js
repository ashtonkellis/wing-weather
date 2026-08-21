/* Static configuration for wing-weather. */
window.WW_CONFIG = {
  // App version, shown in the footer. Bump on every deploy and keep
  // sw.js CACHE ("wing-weather-v<version>") in sync. See CLAUDE.md.
  version: "29",
  // How many days of forecast to fetch (today + the next N-1 days).
  forecastDays: 5,
  // Selectable wing-foil locations. To add one, add an entry here:
  //   "your-slug": { name, latitude, longitude, tideStation }
  // It then appears in the in-app picker and works via ?loc=your-slug.
  // tideStation is a NOAA CO-OPS station id near the spot.
  locations: {
    "harbor-bay-club": {
      name: "Harbor Bay Club",
      latitude: 37.74800,     // 37°44.8801'N 122°14.4924'W
      longitude: -122.24154,
      tideStation: "9414750", // Alameda, San Francisco Bay
    },
  },
  defaultLocation: "harbor-bay-club",
  // The active location, resolved below from ?loc= or the default.
  active: null,
  // The forecast window runs from now until today's sunset (fetched from
  // Open-Meteo). If sunset can't be determined, fall back to this hour (24h).
  fallbackEndHour: 20,
  // Default rideable ranges. min/max are user-configurable; a `null` max
  // means "no upper limit". Overrides live in localStorage.
  defaults: {
    tide: { min: 3.5, max: null, unit: "ft", label: "Tide height", icon: "🌊" },
    wind: { min: 7, max: null, unit: "kn", label: "Wind speed", icon: "💨" },
    temp: { min: 60, max: null, unit: "°F", label: "Temperature", icon: "🌡️" },
  },
};

// Resolve the active location from the ?loc= URL param, else the default.
WW_CONFIG.resolveLocation = function (slug) {
  const locs = WW_CONFIG.locations;
  const key = slug && locs[slug] ? slug : WW_CONFIG.defaultLocation;
  return Object.assign({ slug: key }, locs[key]);
};
// The active location is chosen at startup by app.js — from the ?loc= URL
// param, a saved preference, or the first-run location picker. Null until then.
WW_CONFIG.active = null;
