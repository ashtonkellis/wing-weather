/* Year-in-review: a full-screen infographic of when each parameter (and all
   three together) was rideable over the past 12 months, as calendar heatmaps.
   Data is fetched lazily the first time the view is opened. */
window.WW_Year = (function () {
  const cfg = window.WW_CONFIG;
  const TZ = "America/Los_Angeles";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Heatmap colour ramp (sequential, one hue): dark → green as rideable rises.
  const COLD = [14, 43, 63], WARM = [55, 214, 122];

  let loaded = false;
  let els = null;

  function grab() {
    els = {
      overlay: document.getElementById("year-overlay"),
      body: document.getElementById("year-body"),
      close: document.getElementById("year-close"),
    };
    els.close.addEventListener("click", close);
    els.overlay.addEventListener("click", (e) => { if (e.target === els.overlay) close(); });
  }

  function open() {
    if (!els) grab();
    els.overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (!loaded) load();
  }

  function close() {
    els.overlay.hidden = true;
    document.body.style.overflow = "";
  }

  async function load() {
    els.body.innerHTML = `<p class="status">Crunching a year of data…</p>`;
    try {
      const data = await fetchYear();
      render(data);
      loaded = true;
    } catch (err) {
      els.body.innerHTML =
        `<p class="status error">${(err && err.message) || "Failed to load"}.</p>
         <button class="btn-secondary" onclick="window.WW_Year._retry()">Retry</button>`;
    }
  }

  /* ---- data ---- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function ymdNoaa(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }
  function inRange(v, mn, mx) { return (mn == null || v >= mn) && (mx == null || v <= mx); }

  async function fetchJson(url) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 30000);
    try {
      const r = await fetch(url, { signal: c.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function fetchYear() {
    const th = window.WW_Storage.load();
    const { latitude, longitude } = cfg.active;

    // Archive lags ~5 days; end a week back and span 364 days before it.
    const end = new Date(); end.setDate(end.getDate() - 7);
    const start = new Date(end); start.setDate(start.getDate() - 364);

    const archiveUrl =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&start_date=${ymd(start)}&end_date=${ymd(end)}` +
      "&hourly=temperature_2m,wind_speed_10m,is_day" +
      "&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=" + encodeURIComponent(TZ);
    const tideUrl =
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?product=predictions&application=wing-weather&interval=h&datum=MLLW&units=english" +
      "&time_zone=lst_ldt&format=json&station=" + cfg.active.tideStation +
      `&begin_date=${ymdNoaa(start)}&end_date=${ymdNoaa(end)}`;

    const [arch, tide] = await Promise.all([fetchJson(archiveUrl), fetchJson(tideUrl)]);

    // Tide height by "YYYY-MM-DDTHH" key.
    const tideByKey = {};
    for (const p of (tide.predictions || [])) {
      tideByKey[p.t.replace(" ", "T").slice(0, 13)] = Number(p.v);
    }

    // Aggregate daytime rideable-hours per day.
    const H = arch.hourly;
    const stats = {};
    for (let i = 0; i < H.time.length; i++) {
      if (H.is_day[i] !== 1) continue; // daylight only — can't wing in the dark
      const t = H.time[i];
      const date = t.slice(0, 10);
      const s = stats[date] || (stats[date] = { dt: 0, tide: 0, wind: 0, temp: 0, go: 0 });
      s.dt++;
      const wOk = inRange(H.wind_speed_10m[i], th.wind.min, th.wind.max);
      const pOk = inRange(H.temperature_2m[i], th.temp.min, th.temp.max);
      const td = tideByKey[t.slice(0, 13)];
      const dOk = td != null && inRange(td, th.tide.min, th.tide.max);
      if (wOk) s.wind++;
      if (pOk) s.temp++;
      if (dOk) s.tide++;
      if (wOk && pOk && dOk) s.go++;
    }

    // Dense list of days across the window.
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = ymd(d);
      days.push(Object.assign({ date }, stats[date] || { dt: 0, tide: 0, wind: 0, temp: 0, go: 0 }));
    }
    return { days, th, start: new Date(start), end: new Date(end) };
  }

  /* ---- rendering ---- */
  function mix(t) {
    const c = COLD.map((v, i) => Math.round(v + (WARM[i] - v) * Math.max(0, Math.min(1, t))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function cellColor(day, key) {
    if (!day.dt) return "#0c2337"; // no daylight data
    return mix(day[key] / day.dt);
  }

  function heatmap(days, key) {
    const STEP = 13, CELL = 11, ML = 16, MT = 14;
    const first = new Date(days[0].date + "T12:00:00");
    const firstSun = new Date(first); firstSun.setDate(first.getDate() - first.getDay());
    const pos = (date) => {
      const d = new Date(date + "T12:00:00");
      return { wk: Math.floor((d - firstSun) / (7 * 864e5)), wd: d.getDay() };
    };
    const weeks = pos(days[days.length - 1].date).wk + 1;
    const W = ML + weeks * STEP, Hh = MT + 7 * STEP;

    let cells = "", months = "", lastMonth = -1;
    for (const day of days) {
      const { wk, wd } = pos(day.date);
      const x = ML + wk * STEP, y = MT + wd * STEP;
      const m = Number(day.date.slice(5, 7)) - 1;
      if (m !== lastMonth && wd <= 2) { // label a month near the top of its column
        months += `<text x="${x}" y="10" class="hm-month">${MONTHS[m]}</text>`;
        lastMonth = m;
      }
      const pct = day.dt ? Math.round((day[key] / day.dt) * 100) : 0;
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${cellColor(day, key)}"><title>${day.date}: ${pct}% of daylight rideable (${day[key]}/${day.dt} h)</title></rect>`;
    }
    const wd = ["", "M", "", "W", "", "F", ""];
    let wlabels = "";
    for (let i = 0; i < 7; i++) if (wd[i]) wlabels += `<text x="0" y="${MT + i * STEP + CELL - 2}" class="hm-wd">${wd[i]}</text>`;

    return `<svg class="heatmap" viewBox="0 0 ${W} ${Hh}" role="img">${months}${wlabels}${cells}</svg>`;
  }

  function pctRideable(days, key) {
    let r = 0, dt = 0;
    for (const d of days) { r += d[key]; dt += d.dt; }
    return dt ? Math.round((r / dt) * 100) : 0;
  }
  function bestMonth(days, key) {
    const agg = {};
    for (const d of days) {
      const m = d.date.slice(0, 7);
      const a = agg[m] || (agg[m] = { r: 0, dt: 0 });
      a.r += d[key]; a.dt += d.dt;
    }
    let best = null, bestRatio = -1;
    for (const m in agg) {
      const ratio = agg[m].dt ? agg[m].r / agg[m].dt : 0;
      if (ratio > bestRatio) { bestRatio = ratio; best = m; }
    }
    return best ? MONTHS[Number(best.slice(5, 7)) - 1] : "—";
  }

  function section(icon, title, days, key, statLine) {
    return `<div class="hm-section">
      <div class="hm-head"><span class="hm-title">${icon} ${title}</span><span class="hm-stat">${statLine}</span></div>
      ${heatmap(days, key)}
    </div>`;
  }

  function render({ days, th, start, end }) {
    const goDays = days.filter((d) => d.go >= 2).length;   // days with a real session window
    const goAny = days.filter((d) => d.go >= 1).length;
    const range = `${MONTHS[start.getMonth()]} ${start.getFullYear()} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    const tMax = th.tide.max == null ? "" : `–${th.tide.max}`;
    const wMax = th.wind.max == null ? "+" : `–${th.wind.max}`;
    const pMax = th.temp.max == null ? "" : `–${th.temp.max}`;

    els.body.innerHTML = `
      <p class="year-sub">${cfg.active.name} · ${range} · daylight hours only</p>

      <div class="year-hero">
        <div class="year-hero-num">${goDays}</div>
        <div class="year-hero-lbl">days with a <strong>GO</strong> window<br><span>(≥2 daylight hours all three rideable · ${goAny} days had ≥1)</span></div>
      </div>

      ${section("🟢", "GO — all three rideable", days, "go", `best month: ${bestMonth(days, "go")}`)}
      ${section("🌊", "Tide", days, "tide", `≥${th.tide.min}${tMax} ft · ${pctRideable(days, "tide")}% of daylight`)}
      ${section("💨", "Wind", days, "wind", `${th.wind.min}${wMax} kn · ${pctRideable(days, "wind")}% of daylight`)}
      ${section("🌡️", "Temperature", days, "temp", `≥${th.temp.min}${pMax} °F · ${pctRideable(days, "temp")}% of daylight`)}

      <div class="hm-legend">
        <span>less</span>
        <i style="background:${mix(0)}"></i><i style="background:${mix(0.25)}"></i><i style="background:${mix(0.5)}"></i><i style="background:${mix(0.75)}"></i><i style="background:${mix(1)}"></i>
        <span>more rideable</span>
      </div>
      <p class="year-foot">Each square is a day, coloured by the share of its daylight hours inside your rideable ranges (editable in ⚙️). Wind & temperature: Open-Meteo historical archive. Tide: NOAA predictions.</p>`;
  }

  // Exposed for the inline retry button.
  function _retry() { loaded = false; load(); }

  // Force a refetch next open (e.g. after the location changes).
  function invalidate() { loaded = false; }

  return { open, close, _retry, invalidate };
})();
