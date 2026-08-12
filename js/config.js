/* Static configuration for wing-weather. */
window.WW_CONFIG = {
  // Wing-foil launch near Alameda. Coords from 37°44.8801'N 122°14.4924'W.
  location: {
    name: "Alameda, CA",
    latitude: 37.74800,
    longitude: -122.24154,
  },
  // NOAA CO-OPS tide station: Alameda, San Francisco Bay.
  tideStation: "9414750",
  // How far ahead the "next 3 hours" forecasts look.
  forecastHours: 3,
  // Default rideable ranges. User-configurable; overrides live in localStorage.
  defaults: {
    tide: { min: 1.0, max: 6.0, unit: "ft", label: "Tide height", icon: "🌊" },
    wind: { min: 12, max: 30, unit: "kn", label: "Wind speed", icon: "💨" },
    temp: { min: 50, max: 95, unit: "°F", label: "Temperature", icon: "🌡️" },
  },
};
