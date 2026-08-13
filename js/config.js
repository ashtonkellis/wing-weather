/* Static configuration for wing-weather. */
window.WW_CONFIG = {
  // App version, shown in the footer. Bump on every deploy and keep
  // sw.js CACHE ("wing-weather-v<version>") in sync. See CLAUDE.md.
  version: "12",
  // Wing-foil launch near Alameda. Coords from 37°44.8801'N 122°14.4924'W.
  location: {
    name: "Alameda, CA",
    latitude: 37.74800,
    longitude: -122.24154,
  },
  // NOAA CO-OPS tide station: Alameda, San Francisco Bay.
  tideStation: "9414750",
  // The forecast window runs from now until today's sunset (fetched from
  // Open-Meteo). If sunset can't be determined, fall back to this hour (24h).
  fallbackEndHour: 20,
  // Default rideable ranges. min/max are user-configurable; a `null` max
  // means "no upper limit". Overrides live in localStorage.
  defaults: {
    tide: { min: 1.0, max: null, unit: "ft", label: "Tide height", icon: "🌊" },
    wind: { min: 7, max: 30, unit: "kn", label: "Wind speed", icon: "💨" },
    temp: { min: 65, max: null, unit: "°F", label: "Temperature", icon: "🌡️" },
  },
};
