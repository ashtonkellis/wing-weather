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

  let currentSunset = null; // ISO string for the active forecast window end

  function hhmm(t) {
    return t && t.length >= 16 ? t.slice(11, 16) : "";
  }

  // "2026-08-12T20:12" -> "8:12 PM"
  function fmtTime(iso) {
    if (!iso || iso.length < 16) return "";
    let h = Number(iso.slice(11, 13));
    const m = iso.slice(14, 16);
    const ampm = h < 12 ? "AM" : "PM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function render(conditions, thresholds) {
    el.status.hidden = true;
    el.cards.hidden = false;
    el.cards.innerHTML = "";
    currentSunset = conditions.sunset || null;

    el.cards.appendChild(tideCard(conditions.tide, thresholds.tide));
    el.cards.appendChild(windCard(conditions.wind, thresholds.wind));
    el.cards.appendChild(tempCard(conditions.temp, thresholds.temp));

    el.updated.hidden = false;
    const updatedAt = conditions.fetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    el.updated.textContent = currentSunset
      ? `Updated ${updatedAt} · ☀️ Sunset ${fmtTime(currentSunset)}`
      : `Updated ${updatedAt}`;
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
    const aboveMin = range.min == null || value >= range.min;
    const belowMax = range.max == null || value <= range.max;
    const inRange = aboveMin && belowMax;
    const card = document.createElement("section");
    card.className = "card " + (inRange ? "in-range" : "out-range");

    const shown = meta.unit === "kn" || meta.unit === "°F"
      ? Math.round(value) : value.toFixed(1);

    const rangeRow = range.max == null
      ? `<span>min ${range.min} ${meta.unit}</span><span>no max</span>`
      : `<span>min ${range.min} ${meta.unit}</span><span>max ${range.max} ${meta.unit}</span>`;

    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="card-title">${meta.icon} ${meta.label}</p>
          <p class="card-value">${shown}<span class="card-unit"> ${meta.unit}</span>${opts.valueSuffix || ""}</p>
        </div>
        <span class="badge ${inRange ? "in-range" : "out-range"}">${inRange ? "✓ Rideable" : "✗ Out of range"}</span>
      </div>
      ${opts.sub ? `<p class="sub">${opts.sub}</p>` : ""}
      <div class="range-row">${rangeRow}</div>`;

    if (opts.series && opts.series.length > 1) {
      card.appendChild(forecast(opts.series, range, meta));
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

  function fmtVal(v, unit) {
    return unit === "kn" || unit === "°F" ? String(Math.round(v)) : v.toFixed(1);
  }

  /* Inline SVG sparkline from now to sunset, with a shaded rideable band. */
  function forecast(series, range, meta) {
    const wrap = document.createElement("div");
    wrap.className = "forecast";
    const vals = series.map((p) => p.v);
    const dataLo = Math.min(...vals), dataHi = Math.max(...vals);

    // Y-scale includes the thresholds that exist so the band is visible.
    const lo = range.min != null ? Math.min(dataLo, range.min) : dataLo;
    const hi = range.max != null ? Math.max(dataHi, range.max) : dataHi;
    const span = hi - lo || 1;
    const W = 100, H = 40, pad = 3;
    const x = (i) => series.length === 1 ? W / 2 : pad + (i / (series.length - 1)) * (W - 2 * pad);
    const y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);

    const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

    // Rideable band: from min up to max, or up to the chart top when unbounded.
    const bandBot = range.min != null ? y(range.min) : H - pad;
    const bandTop = range.max != null ? y(range.max) : pad;
    const bandY = Math.min(bandTop, bandBot);
    const bandH = Math.abs(bandBot - bandTop);

    const label = currentSunset ? `Till sunset · ${fmtTime(currentSunset)}` : "Rest of day";
    const summary = `${fmtVal(dataLo, meta.unit)}–${fmtVal(dataHi, meta.unit)} ${meta.unit}`;
    const mid = series[Math.floor((series.length - 1) / 2)];

    wrap.innerHTML = `
      <div class="forecast-label"><span>${label}</span><span>${summary}</span></div>
      <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="${bandY.toFixed(1)}" width="${W}" height="${bandH.toFixed(1)}" fill="rgba(55,214,122,0.14)" />
        <polyline points="${pts}" fill="none" stroke="#2fb8d4" stroke-width="1.6"
          stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      <div class="spark-ticks">
        <span>${hhmm(series[0].t)}</span>
        <span>${hhmm(mid.t)}</span>
        <span>${hhmm(series[series.length - 1].t)}</span>
      </div>`;
    return wrap;
  }

  /* ---- Settings dialog ---- */
  function openSettings(thresholds, onSave, onReset) {
    for (const m of window.WW_Storage.METRICS) {
      const minEl = document.getElementById(`${m}-min`);
      const maxEl = document.getElementById(`${m}-max`);
      if (minEl) minEl.value = thresholds[m].min;
      if (maxEl && thresholds[m].max != null) maxEl.value = thresholds[m].max;
    }
    const form = document.getElementById("settings-form");
    form.onsubmit = () => {
      const next = {};
      for (const m of window.WW_Storage.METRICS) {
        const minEl = document.getElementById(`${m}-min`);
        const maxEl = document.getElementById(`${m}-max`);
        next[m] = {
          min: minEl ? minEl.value : thresholds[m].min,
          max: maxEl ? maxEl.value : null,
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
