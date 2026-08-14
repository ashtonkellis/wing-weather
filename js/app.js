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

  async function refresh() {
    window.WW_UI.setStatus("Loading conditions…", false);
    try {
      const conditions = await window.WW_Api.getConditions();
      window.WW_UI.render(conditions, thresholds);
    } catch (err) {
      window.WW_UI.setStatus(
        (err && err.message ? err.message : "Something went wrong") + " — tap refresh to retry.",
        true
      );
    }
  }

  function rerenderIfLoaded() {
    // Re-fetch so thresholds re-evaluate against fresh data.
    refresh();
  }

  // Set the active location, persist it, and reflect it in the URL + picker.
  function applyLocation(slug) {
    cfg.active = cfg.resolveLocation(slug);
    slug = cfg.active.slug;
    rememberLocation(slug);
    const url = new URL(window.location.href);
    if (url.searchParams.get("loc") !== slug) {
      url.searchParams.set("loc", slug);
      window.history.replaceState({}, "", url); // shareable, and remembered
    }
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

  // Service worker for installability + offline shell.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  /* ---- location selection / boot ---- */
  function startDashboard(slug) {
    applyLocation(slug);
    const onb = document.getElementById("onboarding");
    if (onb) onb.hidden = true;
    refresh();
  }

  function showOnboarding() {
    const list = document.getElementById("onboarding-list");
    list.innerHTML = "";
    for (const slug of Object.keys(cfg.locations)) {
      const btn = document.createElement("button");
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
