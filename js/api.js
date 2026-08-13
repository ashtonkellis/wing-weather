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

  // Minutes since midnight from a "YYYY-MM-DDTHH:mm" string.
  function minutesOf(t) {
    return Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
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
    const day = now.slice(0, 10).replace(/-/g, ""); // "20260812"
    const begin = day + " " + now.slice(11); // "20260812 07:15" for next hi/lo
    const base =
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?product=predictions&application=wing-weather&datum=MLLW" +
      "&units=english&time_zone=lst_ldt&format=json&station=" + cfg.tideStation;

    const [sixMin, hilo] = await Promise.all([
      // 6-minute points across the whole day (midnight to midnight)
      fetchJson(`${base}&begin_date=${day}&end_date=${day}`),
      // hi/lo from now for "next high/low" context
      fetchJson(`${base}&interval=hilo&begin_date=${encodeURIComponent(begin)}&range=24`),
    ]);

    const series = (sixMin.predictions || []).map((p) => ({
      t: p.t.replace(" ", "T"),
      v: Number(p.v),
    }));
    if (!series.length) throw new Error("No tide predictions returned");

    // Current reading = the point nearest to now (series starts at midnight).
    const nowMin = minutesOf(now);
    let ci = 0, best = Infinity;
    for (let i = 0; i < series.length; i++) {
      const diff = Math.abs(minutesOf(series[i].t) - nowMin);
      if (diff < best) { best = diff; ci = i; }
    }
    const value = series[ci].v;
    const nextPt = series[ci + 1] || series[ci];
    const trend = nextPt.v >= value ? "rising" : "falling";

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
      "&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m" +
      "&daily=sunrise,sunset" +
      "&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=" + encodeURIComponent(TZ) +
      "&forecast_days=2";

    const data = await fetchJson(url);
    const cur = data.current || {};
    const now = wallClock(TZ);
    const today = now.slice(0, 10);
    // Today's sunrise/sunset (footer context + night shading on charts).
    const daily = data.daily || {};
    const sunrise = daily.sunrise ? daily.sunrise[0] : null;
    const sunset = daily.sunset ? daily.sunset[0] : fallbackEnd(now);

    const windSeries = hourlyDay(data.hourly, "wind_speed_10m", today);
    const gustSeries = hourlyDay(data.hourly, "wind_gusts_10m", today);
    const tempSeries = hourlyDay(data.hourly, "temperature_2m", today);

    return {
      sunrise: sunrise,
      sunset: sunset,
      temp: { value: cur.temperature_2m, unit: "°F", series: tempSeries },
      wind: {
        value: cur.wind_speed_10m,
        gust: cur.wind_gusts_10m,
        direction: cur.wind_direction_10m,
        unit: "kn",
        series: windSeries,
        gustSeries: gustSeries,
      },
    };
  }

  /* Today's sunset fallback: local date + configured hour. */
  function fallbackEnd(now) {
    const h = String(cfg.fallbackEndHour).padStart(2, "0");
    return now.slice(0, 10) + "T" + h + ":00";
  }

  /* All hourly points that fall on the given local date (midnight to midnight). */
  function hourlyDay(hourly, key, date) {
    if (!hourly || !hourly.time) return [];
    const out = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const t = hourly.time[i];
      if (t.slice(0, 10) === date) out.push({ t, v: Number(hourly[key][i]) });
    }
    return out;
  }

  /* Fetch everything the dashboard needs, tolerating a partial failure.
     Charts span the whole day; `now` positions the "now" marker. */
  async function getConditions() {
    const now = wallClock(TZ);
    const [tideRes, wxRes] = await Promise.allSettled([getTide(), getWeather()]);
    const tide = tideRes.status === "fulfilled" ? tideRes.value : null;
    const wx = wxRes.status === "fulfilled" ? wxRes.value : null;
    if (!tide && !wx) {
      throw new Error("Could not reach weather or tide services.");
    }

    return {
      tide,
      temp: wx ? wx.temp : null,
      wind: wx ? wx.wind : null,
      sunrise: wx ? wx.sunrise : null,
      sunset: wx && wx.sunset ? wx.sunset : fallbackEnd(now),
      now,
      fetchedAt: new Date(),
    };
  }

  return { getConditions, getTide, getWeather };
})();
