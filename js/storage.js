/* Persist user-configured rideable ranges in localStorage.

   Only values that DIFFER from the config defaults are stored. A metric the
   user never customized is left out, so it keeps following js/config.js when
   a default changes. (Previously every save wrote all three metrics, so one
   visit to Settings froze a copy of that day's defaults and silently shadowed
   every later change to them.) */
window.WW_Storage = (function () {
  const KEY = "wing-weather.thresholds.v2";
  const LEGACY_KEYS = ["wing-weather.thresholds.v1"];
  const METRICS = ["tide", "wind", "temp"];

  function load() {
    dropLegacy();
    const d = window.WW_CONFIG.defaults;
    const saved = readSaved();
    const result = {};
    for (const m of METRICS) {
      // A default max of null means the metric is unbounded above; keep it null.
      const maxDefault = d[m].max;
      result[m] = {
        min: numOr(saved[m] && saved[m].min, d[m].min),
        max: maxDefault === null ? null : numOr(saved[m] && saved[m].max, maxDefault),
      };
    }
    return result;
  }

  function save(thresholds) {
    const d = window.WW_CONFIG.defaults;
    const active = {};   // every metric, for the app to render right now
    const overrides = {}; // only what differs from the defaults, for storage
    for (const m of METRICS) {
      const min = numOr(thresholds[m] && thresholds[m].min, d[m].min);
      const max = d[m].max === null ? null : numOr(thresholds[m] && thresholds[m].max, d[m].max);
      active[m] = { min, max };

      const entry = {};
      if (min !== d[m].min) entry.min = min;
      if (max !== null && max !== d[m].max) entry.max = max;
      if (Object.keys(entry).length) overrides[m] = entry;
    }
    try {
      if (Object.keys(overrides).length) localStorage.setItem(KEY, JSON.stringify(overrides));
      else localStorage.removeItem(KEY);
    } catch (_) { /* storage is best-effort (private mode, quota) */ }
    return active;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (_) {}
    return load();
  }

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  // Thresholds saved by an older version stored all three metrics, including
  // untouched ones, so they can't be told apart from real choices. Drop them.
  function dropLegacy() {
    for (const k of LEGACY_KEYS) {
      try { localStorage.removeItem(k); } catch (_) {}
    }
  }

  function numOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  return { load, save, reset, METRICS };
})();
