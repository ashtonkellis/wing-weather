/* App bootstrap: load thresholds, fetch conditions, wire up UI. */
(function () {
  let thresholds = window.WW_Storage.load();

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

  document.getElementById("settings-btn").addEventListener("click", () => {
    window.WW_UI.openSettings(
      thresholds,
      (next) => {
        thresholds = window.WW_Storage.save(next);
        rerenderIfLoaded();
      },
      () => {
        thresholds = window.WW_Storage.reset();
        rerenderIfLoaded();
      }
    );
  });

  document.getElementById("refresh-btn").addEventListener("click", refresh);

  document.getElementById("year-btn").addEventListener("click", () => window.WW_Year.open());

  // Location picker: populate from config, reflect ?loc=, switch on change.
  const locSelect = document.getElementById("loc-select");
  if (locSelect) {
    const locs = window.WW_CONFIG.locations;
    for (const slug of Object.keys(locs)) {
      const opt = document.createElement("option");
      opt.value = slug;
      opt.textContent = locs[slug].name;
      locSelect.appendChild(opt);
    }
    locSelect.value = window.WW_CONFIG.active.slug;
    locSelect.addEventListener("change", () => {
      const slug = locSelect.value;
      const url = new URL(window.location.href);
      url.searchParams.set("loc", slug);
      window.history.replaceState({}, "", url); // shareable URL for this spot
      window.WW_CONFIG.active = window.WW_CONFIG.resolveLocation(slug);
      window.WW_Year.invalidate(); // year data is per-location
      refresh();
    });
  }

  // Show the app version in the footer (single source of truth: config.js).
  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = "v" + window.WW_CONFIG.version;

  // Register the service worker for installability + offline shell.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  refresh();
})();
