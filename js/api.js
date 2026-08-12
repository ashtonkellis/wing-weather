/* Data fetching for wing-weather.
   All calls are client-side against free, no-key, CORS-friendly APIs. */
window.WW_Api = (function () {
  const cfg = window.WW_CONFIG;
  const TZ = "America/Los_Angeles"; // station-local time for NOAA + Open-Meteo

  /* Current wall-clock "YYYY-MM-DDTHH:mm" in the given IANA timezone, so we can
     string-compare against API timestamps returned in that same timezone. */
  function wallClock(tz) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    let hour = p.hour === "24" ? "00" : p.hour; // some engines emit 24
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
  }

  async function fetchJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---- NOAA CO-OPS tide predictions ---- */
  async function getTide() {
    const now = wallClock(TZ); // e.g. 2026-08-12T07:15
    const begin = now.slice(0, 10).replace(/-/g, "") + " " + now.slice(11); // "20260812 07:15"
    // Fetch 6-min points through the end of the day; getConditions() trims
    // the series to today's sunset once Open-Meteo reports it.
    const hoursLeft = Math.min(24, Math.max(1, 24 - Number(now.slice(11, 13))));
    const base =
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?product=predictions&application=wing-weather&datum=MLLW" +
      "&units=english&time_zone=lst_ldt&format=json&station=" + cfg.tideStation;

    const [sixMin, hilo] = await Promise.all([
      fetchJson(`${base}&begin_date=${encodeURIComponent(begin)}&range=${hoursLeft}`),
      // hi/lo over the next day for "next high/low" context
      fetchJson(`${base}&interval=hilo&begin_date=${encodeURIComponent(begin)}&range=24`),
    ]);

    const series = (sixMin.predictions || []).map((p) => ({
      t: p.t.replace(" ", "T"),
      v: Number(p.v),
    }));
    if (!series.length) throw new Error("No tide predictions returned");

    const value = series[0].v;
    const trend = series.length > 1 ? (series[1].v >= value ? "rising" : "falling") : null;

    let nextExtreme = null;
    for (const p of hilo.predictions || []) {
      const t = p.t.replace(" ", "T");
      if (t > now) {
        nextExtreme = { type: p.type === "H" ? "High" : "Low", t, v: Number(p.v) };
        break;
      }
    }

    return { value, unit: "ft", trend, series, nextExtreme };
  }

  /* ---- Open-Meteo wind + temperature ---- */
  async function getWeather() {
    const { latitude, longitude } = cfg.location;
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${latitude}&longitude=${longitude}` +
      "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
      "&hourly=temperature_2m,wind_speed_10m" +
      "&daily=sunset" +
      "&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=" + encodeURIComponent(TZ) +
      "&forecast_days=2";

    const data = await fetchJson(url);
    const cur = data.current || {};
    const now = wallClock(TZ);
    // Today's sunset marks the end of the forecast window.
    const sunset = data.daily && data.daily.sunset ? data.daily.sunset[0] : null;
    const end = sunset || fallbackEnd(now);

    const windSeries = hourlyWindow(data.hourly, "wind_speed_10m", now, end);
    const tempSeries = hourlyWindow(data.hourly, "temperature_2m", now, end);

    return {
      sunset: end,
      temp: { value: cur.temperature_2m, unit: "°F", series: tempSeries },
      wind: {
        value: cur.wind_speed_10m,
        gust: cur.wind_gusts_10m,
        direction: cur.wind_direction_10m,
        unit: "kn",
        series: windSeries,
      },
    };
  }

  /* Today's sunset fallback: local date + configured hour. */
  function fallbackEnd(now) {
    const h = String(cfg.fallbackEndHour).padStart(2, "0");
    return now.slice(0, 10) + "T" + h + ":00";
  }

  /* Hourly points from the current hour through the window end (inclusive). */
  function hourlyWindow(hourly, key, now, end) {
    if (!hourly || !hourly.time) return [];
    const startHour = now.slice(0, 13); // "YYYY-MM-DDTHH"
    const out = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const t = hourly.time[i];
      if (t >= startHour && t <= end) out.push({ t, v: Number(hourly[key][i]) });
    }
    return out;
  }

  /* Fetch everything the dashboard needs, tolerating a partial failure. */
  async function getConditions() {
    const [tideRes, wxRes] = await Promise.allSettled([getTide(), getWeather()]);
    const tideFull = tideRes.status === "fulfilled" ? tideRes.value : null;
    const wx = wxRes.status === "fulfilled" ? wxRes.value : null;
    if (!tideFull && !wx) {
      throw new Error("Could not reach weather or tide services.");
    }

    // The window ends at today's sunset (from Open-Meteo), else a fallback.
    const sunset = wx && wx.sunset ? wx.sunset : fallbackEnd(wallClock(TZ));

    let tide = null;
    if (tideFull) {
      const inWindow = tideFull.series.filter((p) => p.t <= sunset);
      // Keep at least the current reading even if sunset has passed.
      tide = { ...tideFull, series: inWindow.length > 1 ? inWindow : tideFull.series.slice(0, 1) };
    }

    return {
      tide,
      temp: wx ? wx.temp : null,
      wind: wx ? wx.wind : null,
      sunset,
      fetchedAt: new Date(),
    };
  }

  return { getConditions, getTide, getWeather };
})();
