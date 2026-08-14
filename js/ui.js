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

  let currentSunrise = null; // ISO string: today's sunrise (night shading)
  let currentSunset = null;  // ISO string: today's sunset (footer + shading)
  let currentNow = null;     // ISO string: "now", for the now-marker on charts

  function hhmm(t) {
    return t && t.length >= 16 ? t.slice(11, 16) : "";
  }

  function minutesOf(t) {
    return Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
  }

  // Compass direction (16-point) the wind blows FROM.
  function dirName(deg) {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round((deg % 360) / 22.5) % 16];
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
    currentSunrise = conditions.sunrise || null;
    currentSunset = conditions.sunset || null;
    currentNow = conditions.now || null;

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
      sub = `next ${tide.nextExtreme.type.toLowerCase()} ` +
        `${tide.nextExtreme.v.toFixed(1)} ft · ${fmtTime(tide.nextExtreme.t)}`;
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
    // Show direction the wind blows FROM; arrow points the way it travels.
    let sub = "";
    if (wind.direction != null) {
      const deg = Math.round(wind.direction);
      sub = `<span class="wind-arrow" style="transform:rotate(${deg + 180}deg)">↑</span> from ${dirName(wind.direction)} · ${deg}°`;
    }
    return buildCard(defaults.wind, wind.value, range, {
      sub,
      series: wind.series,
      overlay: { series: wind.gustSeries, label: "gusts" },
    });
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

    card.innerHTML = `
      <div class="card-top">
        <div>
          <p class="card-title">${meta.icon} ${meta.label}</p>
          <p class="card-value">${shown}<span class="card-unit"> ${meta.unit}</span>${opts.valueSuffix || ""}</p>
        </div>
        <div class="card-right">
          <span class="badge ${inRange ? "in-range" : "out-range"}">${inRange ? "✓ Rideable" : "✗ Out"}</span>
          ${opts.sub ? `<span class="sub">${opts.sub}</span>` : ""}
        </div>
      </div>`;

    if (opts.series && opts.series.length > 1) {
      card.appendChild(forecast(opts.series, range, meta, opts.overlay));
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

  /* Inline SVG sparkline from now to sunset, with a shaded rideable band.
     An optional dotted overlay (e.g. gusts) is drawn on the same scale. */
  function forecast(series, range, meta, overlay) {
    const wrap = document.createElement("div");
    wrap.className = "forecast";
    const vals = series.map((p) => p.v);
    const dataLo = Math.min(...vals), dataHi = Math.max(...vals);

    const over = overlay && overlay.series && overlay.series.length > 1 ? overlay.series : null;
    const overVals = over ? over.map((p) => p.v) : [];

    // Y-scale includes the thresholds and the overlay so nothing is clipped.
    const loParts = vals.concat(range.min != null ? [range.min] : []);
    const hiParts = vals.concat(overVals, range.max != null ? [range.max] : []);
    const lo = Math.min(...loParts);
    const hi = Math.max(...hiParts);
    const span = hi - lo || 1;
    const W = 100, H = 40, pad = 3;
    const x = (i, n) => n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad);
    const y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);

    const line = (s) => s.map((p, i) => `${x(i, s.length).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

    // Rideable band: from min up to max, or up to the chart top when unbounded.
    const bandBot = range.min != null ? y(range.min) : H - pad;
    const bandTop = range.max != null ? y(range.max) : pad;
    const bandY = Math.min(bandTop, bandBot);
    const bandH = Math.abs(bandBot - bandTop);

    // Left label = the rideable threshold; right = the day's actual range.
    const label = range.max == null
      ? `ride ≥${range.min} ${meta.unit}`
      : `ride ${range.min}–${range.max} ${meta.unit}`;
    const summary = `day ${fmtVal(dataLo, meta.unit)}–${fmtVal(dataHi, meta.unit)}`;
    const mid = series[Math.floor((series.length - 1) / 2)];

    // Map an ISO time to an x within the series' own time span (clamped).
    const t0 = minutesOf(series[0].t), tN = minutesOf(series[series.length - 1].t);
    const xForTime = (iso) => {
      if (!iso || tN <= t0) return null;
      const f = (minutesOf(iso) - t0) / (tN - t0);
      return Math.max(0, Math.min(W, pad + f * (W - 2 * pad)));
    };

    // Nighttime shading: before sunrise and after sunset.
    let nightSvg = "";
    const xsr = xForTime(currentSunrise), xss = xForTime(currentSunset);
    if (xsr != null && xsr > 0) nightSvg += `<rect x="0" y="0" width="${xsr.toFixed(1)}" height="${H}" fill="#05182b" opacity="0.42" />`;
    if (xss != null && xss < W) nightSvg += `<rect x="${xss.toFixed(1)}" y="0" width="${(W - xss).toFixed(1)}" height="${H}" fill="#05182b" opacity="0.42" />`;

    // Vertical "now" marker.
    let nowSvg = "";
    const nx = xForTime(currentNow);
    if (nx != null && minutesOf(currentNow) >= t0 && minutesOf(currentNow) <= tN) {
      nowSvg = `<line x1="${nx.toFixed(1)}" y1="0" x2="${nx.toFixed(1)}" y2="${H}" stroke="var(--text)"
        stroke-width="1.2" vector-effect="non-scaling-stroke" opacity="0.6" />`;
    }

    const overlaySvg = over
      ? `<polyline points="${line(over)}" fill="none" stroke="var(--muted)" stroke-width="1.6"
           vector-effect="non-scaling-stroke" stroke-dasharray="1 4" stroke-linecap="round" opacity="0.9" />`
      : "";
    const nowChip = currentNow ? `<span><i class="swatch nowbar"></i>now ${hhmm(currentNow)}</span>` : "";
    const gustChip = over
      ? `<span><i class="swatch dotted"></i>${overlay.label} · peak ${fmtVal(Math.max(...overVals), meta.unit)} ${meta.unit}</span>`
      : "";
    const legend = (nowChip || gustChip)
      ? `<div class="spark-legend">${nowChip}${gustChip}</div>`
      : "";

    wrap.innerHTML = `
      <div class="forecast-label"><span>${label}</span><span>${summary}</span></div>
      <div class="spark-wrap">
        <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          ${nightSvg}
          <rect x="0" y="${bandY.toFixed(1)}" width="${W}" height="${bandH.toFixed(1)}" fill="rgba(55,214,122,0.14)" />
          ${nowSvg}
          ${overlaySvg}
          <polyline points="${line(series)}" fill="none" stroke="#2fb8d4" stroke-width="1.6"
            stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <div class="spark-cursor" hidden></div>
        <div class="spark-tip" hidden></div>
      </div>
      <div class="spark-ticks">
        <span>${hhmm(series[0].t)}</span>
        <span>${hhmm(mid.t)}</span>
        <span>${hhmm(series[series.length - 1].t)}</span>
      </div>
      ${legend}`;

    attachScrub(wrap, series, meta, over, overlay);
    return wrap;
  }

  /* Tap/drag a chart to read the time (and value) at that point. */
  function attachScrub(wrap, series, meta, over, overlay) {
    const box = wrap.querySelector(".spark-wrap");
    const cursor = wrap.querySelector(".spark-cursor");
    const tip = wrap.querySelector(".spark-tip");
    const n = series.length;

    function at(x, i0, i1, f) {
      return series[i0][x] + (series[i1][x] - series[i0][x]) * f;
    }
    function show(clientX) {
      const rect = box.getBoundingClientRect();
      let f = (clientX - rect.left) / rect.width;
      f = Math.max(0, Math.min(1, f));
      const idx = f * (n - 1);
      const i0 = Math.floor(idx), i1 = Math.min(i0 + 1, n - 1), t = idx - i0;
      const mins = Math.round(minutesOf(series[i0].t) + (minutesOf(series[i1].t) - minutesOf(series[i0].t)) * t);
      const hh = String(Math.floor(mins / 60) % 24).padStart(2, "0");
      const mm = String(((mins % 60) + 60) % 60).padStart(2, "0");
      const val = at("v", i0, i1, t);
      let text = `${hh}:${mm} · ${fmtVal(val, meta.unit)} ${meta.unit}`;
      if (over) {
        const gv = over[i0].v + (over[i1].v - over[i0].v) * t;
        text += ` · ${overlay.label} ${fmtVal(gv, meta.unit)}`;
      }
      cursor.style.left = (f * 100) + "%";
      tip.style.left = (Math.max(0.12, Math.min(0.88, f)) * 100) + "%";
      tip.textContent = text;
      cursor.hidden = false;
      tip.hidden = false;
    }

    let active = false;
    box.addEventListener("pointerdown", (e) => {
      active = true;
      if (box.setPointerCapture) { try { box.setPointerCapture(e.pointerId); } catch (_) {} }
      show(e.clientX);
    });
    box.addEventListener("pointermove", (e) => { if (active) show(e.clientX); });
    const end = () => { active = false; };
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
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
