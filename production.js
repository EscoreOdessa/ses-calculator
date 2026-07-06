// production.js — «Виробництво електроенергії» (PVGIS). Портовано з
// Виробництво_AppsScript.gs. Два запити до PVGIS: 1) optimalangles=1 щоб
// дізнатись ідеальний кут; 2) явний angle=<підігнаний під 15/20/30°>&aspect=0
// (південь) — саме ця відповідь (місяці/рік) показується як результат.

const LAST_ADDR_KEY_PROD = "ses_last_address"; // спільний ключ з panels.js

(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  const MONTHS = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

  ready(() => {
    const el = (id) => document.getElementById(id);

    if (!MAPS_API_KEY) {
      el("prod-no-key").style.display = "";
    }

    let lastChart = null; // {monthly, annual, tiltUsed, tiltIdeal, ok}

    function setStatus(text) {
      el("pv-status").textContent = text;
    }

    function tryParseCoords(text) {
      const toks = (text || "").match(/-?\d+(?:[.,]\d+)?/g);
      if (toks && toks.length >= 2) {
        const lat = parseFloat(toks[0].replace(",", "."));
        const lng = parseFloat(toks[1].replace(",", "."));
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
      }
      return null;
    }

    function rememberAddress(addr) {
      addr = String(addr || "").trim();
      if (addr) localStorage.setItem(LAST_ADDR_KEY_PROD, addr);
    }

    // ---- Автозаповнення при завантаженні вкладки ----
    function prefill() {
      const fromCalc = window.SesApp ? window.SesApp.getCoordsText() : "";
      const remembered = fromCalc || localStorage.getItem(LAST_ADDR_KEY_PROD) || "";
      if (remembered) el("pv-addr").value = remembered;

      const lastResult = window.SesApp ? window.SesApp.getLastResult() : null;
      if (lastResult) {
        const kw = lastResult.panelTotalKw || lastResult.stationPowerKw || 0;
        if (kw) el("pv-power").value = kw;
      }
    }
    prefill();
    // Якщо менеджер ще не рахував на калькуляторі при першому відкритті вкладки — оновимо при кожному переключенні на неї.
    document.querySelectorAll('.tab-btn[data-tab="production"]').forEach((btn) => {
      btn.addEventListener("click", prefill);
    });

    function findAddress() {
      const text = el("pv-addr").value.trim();
      if (!text) return;
      const coords = tryParseCoords(text);
      if (coords) {
        rememberAddress(text);
        return coords;
      }
      if (!MAPS_API_KEY) {
        alert("Без ключа Google Maps API пошук за текстовою адресою недоступний — введіть координати напряму, напр. 50.4501, 30.5234.");
        return null;
      }
      return "geocode-pending";
    }

    function geocodeAndCalc(text) {
      SesMapsLoader.ensure(MAPS_API_KEY, () => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: text }, (results, status) => {
          if (status === "OK" && results[0]) {
            const loc = results[0].geometry.location;
            rememberAddress(text);
            runCalculation({ lat: loc.lat(), lng: loc.lng() });
          } else {
            setStatus("Адресу не знайдено (" + status + ").");
          }
        });
      });
    }

    function pvgisUrl(lat, lon, peakKw, extra) {
      let url =
        "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lon) +
        "&peakpower=" +
        encodeURIComponent(peakKw) +
        "&loss=14&outputformat=json";
      Object.keys(extra || {}).forEach((k) => {
        url += "&" + k + "=" + encodeURIComponent(extra[k]);
      });
      return url;
    }

    async function fetchIdealTilt(lat, lon, peakKw) {
      try {
        const d = await fetchPvgisJson(pvgisUrl(lat, lon, peakKw, { optimalangles: 1 }));
        const ms = d.inputs && d.inputs.mounting_system && d.inputs.mounting_system.fixed;
        const slope = ms && ms.slope && typeof ms.slope.value === "number" ? ms.slope.value : null;
        if (slope === null) throw new Error("no slope");
        return { ideal: slope, ok: true };
      } catch (e) {
        return { ideal: SesGeometry.fallbackTilt(lat), ok: false };
      }
    }

    async function fetchProduction(lat, lon, peakKw, angle) {
      const d = await fetchPvgisJson(pvgisUrl(lat, lon, peakKw, { angle, aspect: 0 }));
      const monthly = d.outputs.monthly.fixed.map((m) => m.E_m);
      const annual = d.outputs.totals.fixed.E_y;
      return { monthly, annual };
    }

    async function runCalculation(coords) {
      const peakKw = parseFloat(el("pv-power").value) || 0;
      if (!peakKw) {
        setStatus("Вкажіть потужність станції, кВт.");
        return;
      }
      setStatus("Рахую...");
      el("pv-canvas").style.display = "none";

      const { ideal, ok: idealOk } = await fetchIdealTilt(coords.lat, coords.lng, peakKw);
      const tiltUsed = SesGeometry.snapToAllowedTilt(ideal);

      try {
        const { monthly, annual } = await fetchProduction(coords.lat, coords.lng, peakKw, tiltUsed);
        lastChart = { monthly, annual, tiltUsed, tiltIdeal: Math.round(ideal), ok: true };
        setStatus(
          "Кут кріплень: " + tiltUsed + "° (ідеал ≈" + Math.round(ideal) + "°" + (idealOk ? "" : ", орієнтовно") + ")"
        );
        drawChart(lastChart);
      } catch (e) {
        setStatus(
          (PVGIS_PROXIES.length
            ? "Не вдалося отримати дані з PVGIS — ні напряму, ні через жоден із запасних проксі. Спробуйте ще раз за хвилину."
            : "PVGIS блокує прямі запити з браузера (CORS) — потрібен проксі. Див. «Налаштування_PVGIS_Proxy.md» в папці сайту, або порахуйте вручну на re.jrc.ec.europa.eu/pvg_tools/.") +
            (e && e.message ? " Деталі: " + e.message : "")
        );
      }
    }

    function drawChart(chart) {
      const cv = el("pv-canvas");
      cv.style.display = "";
      const g = cv.getContext("2d");
      const W = cv.width,
        H = cv.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      const padL = 60,
        padR = 20,
        padT = 60,
        padB = 60;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;
      const maxVal = Math.max(...chart.monthly) * 1.15;
      const barGap = 10;
      const barW = (chartW - barGap * (chart.monthly.length - 1)) / chart.monthly.length;

      g.fillStyle = "#05564D";
      g.font = "bold 20px Arial";
      g.fillText("Орієнтовне виробництво електроенергії, кВт·год/міс", padL, 32);

      g.fillStyle = "#666";
      g.font = "13px Arial";
      g.fillText(
        "Рік: ≈ " + Math.round(chart.annual).toLocaleString("uk-UA") + " кВт·год · кут кріплень " + chart.tiltUsed + "° (ідеал ≈" + chart.tiltIdeal + "°), південь",
        padL,
        50
      );

      // осі
      g.strokeStyle = "#d7dee0";
      g.beginPath();
      g.moveTo(padL, padT);
      g.lineTo(padL, padT + chartH);
      g.lineTo(padL + chartW, padT + chartH);
      g.stroke();

      chart.monthly.forEach((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = padL + i * (barW + barGap);
        const y = padT + chartH - barH;
        g.fillStyle = "#1a73e8";
        g.fillRect(x, y, barW, barH);

        g.fillStyle = "#222";
        g.font = "11px Arial";
        g.textAlign = "center";
        g.fillText(Math.round(val), x + barW / 2, y - 6);
        g.fillText(MONTHS[i], x + barW / 2, padT + chartH + 18);
      });
      g.textAlign = "left";
    }

    function savePng() {
      if (!lastChart) {
        setStatus("Спочатку порахуйте виробництво.");
        return;
      }
      const cv = el("pv-canvas");
      const client = (el("in-client") && el("in-client").value.trim()) || "об'єкт";
      const safeName = String(client).replace(/[\/\\]/g, "-").trim();
      const a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = `${safeName} — виробництво.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // ---- Прив'язка ----
    el("pv-find").addEventListener("click", () => {
      const res = findAddress();
      if (res === "geocode-pending") geocodeAndCalc(el("pv-addr").value.trim());
      else if (res) runCalculation(res);
    });
    el("pv-calc").addEventListener("click", () => {
      const text = el("pv-addr").value.trim();
      const coords = tryParseCoords(text);
      if (coords) {
        runCalculation(coords);
      } else {
        el("pv-find").click();
      }
    });
    el("pv-save").addEventListener("click", savePng);
    el("pv-addr").addEventListener("keydown", (e) => {
      if (e.key === "Enter") el("pv-find").click();
    });
  });
})();
