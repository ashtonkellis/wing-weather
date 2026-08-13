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

  // Register the service worker for installability + offline shell.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  refresh();
})();
