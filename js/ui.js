/* Rendering for wing-weather. */
window.WW_UI = (function () {
  const defaults = window.WW_CONFIG.defaults;

  const el = {
    status: document.getElementById("status"),
    cards: document.getElementById("cards"),
    updated: document.getElementById("updated"),
    refresh: document.getElementById("refresh-btn"),
    dialog: document.getElementById("settings-dialog"),
  };

  function setStatus(message, isError) {
    el.status.hidden = false;
    el.status.textContent = message;
    el.status.classList.toggle("error", !!isError);
    el.cards.hidden = true;
    el.updated.hidden = true;
    el.refresh.hidden = !isError;
  }

  function hhmm(t) {
    return t && t.length >= 16 ? t.slice(11, 16) : "";
  }

  function render(conditions, thresholds) {
    el.status.hidden = true;
    el.cards.hidden = false;
    el.cards.innerHTML = "";

    el.cards.appendChild(tideCard(conditions.tide, thresholds.tide));
    el.cards.appendChild(windCard(conditions.wind, thresholds.wind));
    el.cards.appendChild(tempCard(conditions.temp, thresholds.temp));

    el.updated.hidden = false;
    el.updated.textContent = "Updated " + conditions.fetchedAt.toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    });
    el.refresh.hidden = false;
  }

  function tideCard(tide, range) {
    if (!tide) return errorCard(defaults.tide, "Tide data unavailable");
    const value = tide.value;
    let sub = "";
    if (tide.nextExtreme) {
      sub = `Next ${tide.nextExtreme.type.toLowerCase()}: ` +
        `${tide.nextExtreme.v.toFixed(1)} ft @ ${hhmm(tide.nextExtreme.t)}`;
    }
    const trendArrow = tide.trend === "rising" ? " ↑" : tide.trend === "falling" ? " ↓" : "";
    return buildCard(defaults.tide, value, range, {
      valueSuffix: trendArrow,
      sub,
      series: tide.series,
    });
  }

  function windCard(wind, range) {
    if (!wind || wind.value == null) return errorCard(defaults.wind, "Wind data unavailable");
    const sub = wind.gust != null ? `Gusts to ${Math.round(wind.gust)} kn` : "";
    return buildCard(defaults.wind, wind.value, range, { sub, series: wind.series });
  }

  function tempCard(temp, range) {
    if (!temp || temp.value == null) return errorCard(defaults.temp, "Temp data unavailable");
    return buildCard(defaults.temp, temp.value, range, { series: temp.series });
  }

  function buildCard(meta, value, range, opts) {
    opts = opts || {};
    const inRange = value >= range.min && value <= range.max;
    const card = document.createElement("section");
    card.className = "card " + (inRange ? "in-range" : "out-range");

    const shown = meta.unit === "kn" || meta.unit === "°F"
      ? Math.round(value) : value.toFixed(1);

    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="card-title">${meta.icon} ${meta.label}</p>
          <p class="card-value">${shown}<span class="card-unit"> ${meta.unit}</span>${opts.valueSuffix || ""}</p>
        </div>
        <span class="badge ${inRange ? "in-range" : "out-range"}">${inRange ? "✓ Rideable" : "✗ Out of range"}</span>
      </div>
      ${opts.sub ? `<p class="sub">${opts.sub}</p>` : ""}
      <div class="range-row">
        <span>min ${range.min} ${meta.unit}</span>
        <span>max ${range.max} ${meta.unit}</span>
      </div>`;

    if (opts.series && opts.series.length > 1) {
      card.appendChild(forecast(opts.series, range));
    }
    return card;
  }

  function errorCard(meta, message) {
    const card = document.createElement("section");
    card.className = "card";
    card.innerHTML = `
      <div class="card-top">
        <p class="card-title">${meta.icon} ${meta.label}</p>
      </div>
      <p class="sub">${message}</p>`;
    return card;
  }

  /* Inline SVG sparkline of the next few hours, with a shaded rideable band. */
  function forecast(series, range) {
    const wrap = document.createElement("div");
    wrap.className = "forecast";
    const vals = series.map((p) => p.v);
    const lo = Math.min(...vals, range.min);
    const hi = Math.max(...vals, range.max);
    const span = hi - lo || 1;
    const W = 100, H = 40, pad = 3;
    const x = (i) => series.length === 1 ? W / 2 : pad + (i / (series.length - 1)) * (W - 2 * pad);
    const y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);

    const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const bandTop = y(range.max), bandBot = y(range.min);

    wrap.innerHTML = `
      <p class="forecast-label">Next ${window.WW_CONFIG.forecastHours}h</p>
      <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="${Math.min(bandTop, bandBot).toFixed(1)}" width="${W}"
          height="${Math.abs(bandBot - bandTop).toFixed(1)}" fill="rgba(55,214,122,0.14)" />
        <polyline points="${pts}" fill="none" stroke="#2fb8d4" stroke-width="1.6"
          stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      <div class="spark-ticks">
        <span>${hhmm(series[0].t)}</span>
        <span>${hhmm(series[series.length - 1].t)}</span>
      </div>`;
    return wrap;
  }

  /* ---- Settings dialog ---- */
  function openSettings(thresholds, onSave, onReset) {
    for (const m of window.WW_Storage.METRICS) {
      document.getElementById(`${m}-min`).value = thresholds[m].min;
      document.getElementById(`${m}-max`).value = thresholds[m].max;
    }
    const form = document.getElementById("settings-form");
    form.onsubmit = () => {
      const next = {};
      for (const m of window.WW_Storage.METRICS) {
        next[m] = {
          min: document.getElementById(`${m}-min`).value,
          max: document.getElementById(`${m}-max`).value,
        };
      }
      onSave(next);
    };
    document.getElementById("reset-btn").onclick = () => {
      el.dialog.close();
      onReset();
    };
    el.dialog.showModal();
  }

  return { setStatus, render, openSettings };
})();
