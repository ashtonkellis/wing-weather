/* App bootstrap: choose the location (URL ?loc= → saved preference →
   first-run picker), then load thresholds, fetch conditions, and wire the UI. */
(function () {
  const cfg = window.WW_CONFIG;
  const LOC_KEY = "wing-weather.location.v1";
  let thresholds = window.WW_Storage.load();

  function savedLocation() {
    try { return localStorage.getItem(LOC_KEY); } catch (_) { return null; }
  }
  function rememberLocation(slug) {
    try { localStorage.setItem(LOC_KEY, slug); } catch (_) {}
  }

  let forecast = null;      // multi-day data from the last fetch
  let selectedDate = null;  // which day is shown

  async function refresh() {
    window.WW_UI.setStatus("Loading conditions…", false);
    hideTabs();
    try {
      forecast = await window.WW_Api.getForecast();
      if (!selectedDate || !forecast.byDate[selectedDate]) selectedDate = forecast.today;
      renderDay();
    } catch (err) {
      window.WW_UI.setStatus(
        (err && err.message ? err.message : "Something went wrong") + " — tap refresh to retry.",
        true
      );
    }
  }

  // Render the currently selected day from already-fetched data (no refetch).
  function renderDay() {
    if (!forecast) return;
    const conditions = window.WW_Api.buildDay(forecast, selectedDate);
    window.WW_UI.render(conditions, thresholds);
    renderTabs();
  }

  function hideTabs() {
    const tabs = document.getElementById("day-tabs");
    if (tabs) tabs.hidden = true;
  }

  function renderTabs() {
    const tabs = document.getElementById("day-tabs");
    if (!tabs || !forecast) return;
    tabs.innerHTML = "";
    for (const date of forecast.days) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-tab" + (date === selectedDate ? " active" : "");
      btn.textContent = date === forecast.today ? "Today" : window.WW_UI.fmtDayLabel(date, false);
      btn.addEventListener("click", () => {
        if (selectedDate === date) return;
        selectedDate = date;
        renderDay();
      });
      tabs.appendChild(btn);
    }
    tabs.hidden = forecast.days.length < 2;
  }

  // Thresholds changed → just re-render the current day (data is cached).
  function rerenderIfLoaded() {
    if (forecast) renderDay();
  }

  // Set the active location, persist it, and reflect it in the URL + picker.
  function applyLocation(slug) {
    cfg.active = cfg.resolveLocation(slug);
    slug = cfg.active.slug;
    rememberLocation(slug);
    // Reflect the choice in the URL (shareable). Non-fatal: some browsers
    // (notably iOS Safari) can throw on replaceState — never let that block
    // navigation into the app.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("loc") !== slug) {
        params.set("loc", slug);
        window.history.replaceState({}, "", "?" + params.toString());
      }
    } catch (_) { /* URL update is best-effort */ }
    const locSelect = document.getElementById("loc-select");
    if (locSelect) locSelect.value = slug;
  }

  /* ---- one-time UI wiring ---- */
  document.getElementById("settings-btn").addEventListener("click", () => {
    window.WW_UI.openSettings(
      thresholds,
      (next) => { thresholds = window.WW_Storage.save(next); rerenderIfLoaded(); },
      () => { thresholds = window.WW_Storage.reset(); rerenderIfLoaded(); }
    );
  });

  document.getElementById("refresh-btn").addEventListener("click", refresh);
  document.getElementById("year-btn").addEventListener("click", () => window.WW_Year.open());

  // Location picker in the header: populate, switch on change.
  const locSelect = document.getElementById("loc-select");
  if (locSelect) {
    for (const slug of Object.keys(cfg.locations)) {
      const opt = document.createElement("option");
      opt.value = slug;
      opt.textContent = cfg.locations[slug].name;
      locSelect.appendChild(opt);
    }
    locSelect.addEventListener("change", () => {
      applyLocation(locSelect.value);
      window.WW_Year.invalidate(); // year data is per-location
      refresh();
    });
  }

  // App version in the footer (single source of truth: config.js).
  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = "v" + cfg.version;

  // Service worker for installability + offline shell. When a new version
  // takes control, reload once so the page runs a consistent set of files
  // (fixes stale/mixed-version states on aggressively-caching browsers).
  if ("serviceWorker" in navigator) {
    let hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) { hadController = true; return; } // first install: no reload
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  /* ---- location selection / boot ---- */
  function startDashboard(slug) {
    // Leave the picker immediately on tap, before anything that could throw.
    const onb = document.getElementById("onboarding");
    if (onb) onb.hidden = true;
    try { applyLocation(slug); }
    catch (_) { cfg.active = cfg.resolveLocation(slug); } // never block entry
    refresh();
  }

  function showOnboarding() {
    const list = document.getElementById("onboarding-list");
    const slugs = Object.keys(cfg.locations || {});
    // Defensive: if config somehow has no locations, don't get stuck here.
    if (!slugs.length) { startDashboard(cfg.defaultLocation); return; }
    list.innerHTML = "";
    for (const slug of slugs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "onboarding-choice";
      btn.textContent = cfg.locations[slug].name;
      btn.addEventListener("click", () => startDashboard(slug));
      list.appendChild(btn);
    }
    document.getElementById("onboarding").hidden = false;
  }

  // Resolve where to start: explicit URL, then saved preference, then picker.
  const urlSlug = new URLSearchParams(window.location.search).get("loc");
  const stored = savedLocation();
  if (urlSlug && cfg.locations[urlSlug]) {
    startDashboard(urlSlug);
  } else if (stored && cfg.locations[stored]) {
    startDashboard(stored); // revisit → auto-route to the remembered spot
  } else {
    showOnboarding(); // first visit → pick a location
  }
})();
