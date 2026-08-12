/* Persist user-configured rideable ranges in localStorage. */
window.WW_Storage = (function () {
  const KEY = "wing-weather.thresholds.v1";
  const METRICS = ["tide", "wind", "temp"];

  function load() {
    const d = window.WW_CONFIG.defaults;
    const result = {};
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (_) {
      saved = {};
    }
    for (const m of METRICS) {
      result[m] = {
        min: numOr(saved[m] && saved[m].min, d[m].min),
        max: numOr(saved[m] && saved[m].max, d[m].max),
      };
    }
    return result;
  }

  function save(thresholds) {
    const clean = {};
    for (const m of METRICS) {
      clean[m] = { min: Number(thresholds[m].min), max: Number(thresholds[m].max) };
    }
    localStorage.setItem(KEY, JSON.stringify(clean));
    return clean;
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  function numOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  return { load, save, reset, METRICS };
})();
