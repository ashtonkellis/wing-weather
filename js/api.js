/* Data fetching for wing-weather.
   All calls are client-side against free, no-key, CORS-friendly APIs.
   getForecast() fetches several days at once; buildDay() slices one day. */
window.WW_Api = (function () {
  const cfg = window.WW_CONFIG;
  const TZ = "America/Los_Angeles"; // station-local time for NOAA + Open-Meteo

  function wallClock(tz) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    let hour = p.hour === "24" ? "00" : p.hour;
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
  }

  function minutesOf(t) {
    return Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  async function fetchJson(url, timeoutMs = 15000) {
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

  function fallbackEnd(now) {
    return now.slice(0, 10) + "T" + pad(cfg.fallbackEndHour) + ":00";
  }

  /* All hourly points on the given local date (midnight to midnight). */
  function hourlyDay(hourly, key, date) {
    if (!hourly || !hourly.time) return [];
    const out = [];
    for (let i = 0; i < hourly.time.length; i++) {
      if (hourly.time[i].slice(0, 10) === date) out.push({ t: hourly.time[i], v: Number(hourly[key][i]) });
    }
    return out;
  }

  /* ---- Fetch several days of tide + weather in one shot ---- */
  async function getForecast() {
    const now = wallClock(TZ);
    const today = now.slice(0, 10);
    const N = cfg.forecastDays || 5;

    // Date range for NOAA (YYYYMMDD): today .. today + (N-1).
    const start = new Date(today + "T12:00:00");
    const end = new Date(start); end.setDate(start.getDate() + (N - 1));
    const ymdNoaa = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

    const { latitude, longitude } = cfg.active;
    const omUrl =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${latitude}&longitude=${longitude}` +
      "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
      "&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m" +
      "&daily=sunrise,sunset" +
      "&temperature_unit=fahrenheit&wind_speed_unit=kn&timezone=" + encodeURIComponent(TZ) +
      `&forecast_days=${N}`;
    const tideBase =
      "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" +
      "?product=predictions&application=wing-weather&datum=MLLW&units=english" +
      "&time_zone=lst_ldt&format=json&station=" + cfg.active.tideStation;
    const tideUrl = `${tideBase}&begin_date=${ymdNoaa(start)}&end_date=${ymdNoaa(end)}`;
    const hiloUrl = `${tideBase}&interval=hilo&begin_date=${ymdNoaa(start)}&end_date=${ymdNoaa(end)}`;

    const [omRes, tideRes, hiloRes] = await Promise.allSettled([
      fetchJson(omUrl), fetchJson(tideUrl), fetchJson(hiloUrl),
    ]);
    const om = omRes.status === "fulfilled" ? omRes.value : null;
    const tide6 = tideRes.status === "fulfilled" ? tideRes.value : null;
    const hilo = hiloRes.status === "fulfilled" ? hiloRes.value : null;
    if (!om && !tide6) throw new Error("Could not reach weather or tide services.");

    const days = (om && om.daily && om.daily.time) ? om.daily.time.slice() : [today];
    const tidePoints = (tide6 && tide6.predictions ? tide6.predictions : [])
      .map((p) => ({ t: p.t.replace(" ", "T"), v: Number(p.v) }));
    const hiloPoints = (hilo && hilo.predictions ? hilo.predictions : [])
      .map((p) => ({ t: p.t.replace(" ", "T"), v: Number(p.v), type: p.type }));

    const byDate = {};
    for (let i = 0; i < days.length; i++) {
      const date = days[i];
      byDate[date] = {
        tideSeries: tidePoints.filter((p) => p.t.slice(0, 10) === date),
        windSeries: hourlyDay(om && om.hourly, "wind_speed_10m", date),
        gustSeries: hourlyDay(om && om.hourly, "wind_gusts_10m", date),
        tempSeries: hourlyDay(om && om.hourly, "temperature_2m", date),
        sunrise: om && om.daily && om.daily.sunrise ? om.daily.sunrise[i] : fallbackEnd(date + "T00:00"),
        sunset: om && om.daily && om.daily.sunset ? om.daily.sunset[i] : fallbackEnd(date + "T00:00"),
      };
    }

    return { now, today, days, byDate, current: (om && om.current) || {}, hiloPoints };
  }

  /* ---- Build a single day's conditions object for rendering ---- */
  function buildDay(forecast, date) {
    if (!forecast.byDate[date]) date = forecast.today;
    const d = forecast.byDate[date];
    const isToday = date === forecast.today;
    const now = isToday ? forecast.now : null;
    const cur = forecast.current || {};

    // Tide
    let tide = null;
    if (d.tideSeries && d.tideSeries.length > 1) {
      const series = d.tideSeries;
      let value = null, trend = null, nextExtreme = null;
      if (isToday) {
        const nowMin = minutesOf(forecast.now);
        let ci = 0, best = Infinity;
        for (let i = 0; i < series.length; i++) {
          const diff = Math.abs(minutesOf(series[i].t) - nowMin);
          if (diff < best) { best = diff; ci = i; }
        }
        value = series[ci].v;
        trend = (series[ci + 1] || series[ci]).v >= value ? "rising" : "falling";
        for (const p of forecast.hiloPoints) {
          if (p.t > forecast.now) { nextExtreme = { type: p.type === "H" ? "High" : "Low", t: p.t, v: p.v }; break; }
        }
      }
      tide = { unit: "ft", series, value, trend, nextExtreme };
    }

    // Wind
    let wind = null;
    if (d.windSeries && d.windSeries.length > 1) {
      wind = {
        unit: "kn",
        series: d.windSeries,
        gustSeries: d.gustSeries,
        value: isToday ? cur.wind_speed_10m : null,
        gust: isToday ? cur.wind_gusts_10m : null,
        direction: isToday ? cur.wind_direction_10m : null,
      };
    }

    // Temperature
    let temp = null;
    if (d.tempSeries && d.tempSeries.length > 1) {
      temp = { unit: "°F", series: d.tempSeries, value: isToday ? cur.temperature_2m : null };
    }

    return {
      date, isToday, now,
      tide, wind, temp,
      sunrise: d.sunrise,
      sunset: d.sunset,
      fetchedAt: new Date(),
    };
  }

  return { getForecast, buildDay };
})();
