// panels.js — «Розкладка панелей на даху» (карта + авто-раскладка).
// Портовано з Панелі_AppsScript.gs. Геометрія розкладки — у geometry.js
// (чиста, без залежності від Maps API). Тут — тільки UI, карта, PVGIS, PNG.

// ЗАПОВНІТЬ КЛЮЧ (див. Налаштування_Google_Cloud.md):
const MAPS_API_KEY = "AIzaSyDrh0z0gHcxjcGVVsIeLqxe7XiNr9gL_ls";

// PVGIS блокує прямі запити з браузера (CORS). Якщо розгорнули власний
// Cloudflare Worker — див. Налаштування_PVGIS_Proxy.md — впишіть його адресу
// ПЕРШИМ пунктом у список нижче (з "?url=" в кінці). Публічні безкоштовні
// проксі (allorigins/corsproxy/codetabs) лишені як запасні — вони не завжди
// надійні (можуть тимчасово лежати чи бути перевантажені), тому пробуємо
// декілька по черзі, а не один. Порожній масив = без проксі: «Розкладка
// панелей» тоді рахує кут наближено за формулою, а «Виробництво
// електроенергії» не працюватиме зовсім (це основна його функція).
const PVGIS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

// Кеш відповідей PVGIS у localStorage: кліматичні середні (виробництво/кут)
// для однієї й тієї ж адреси+потужності+кута не змінюються день у день, тож
// повторний розрахунок того самого об'єкта (типова ситуація — менеджер
// перерахував/повернувся до клієнта) бере дані з кешу МИТТЄВО, без мережі —
// і взагалі не залежить від того, чи живі зараз проксі.
const PVGIS_CACHE_KEY = "ses_pvgis_cache_v1";
const PVGIS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 днів
const PVGIS_CACHE_MAX_ENTRIES = 50;

function pvgisCacheGet(url) {
  try {
    const cache = JSON.parse(localStorage.getItem(PVGIS_CACHE_KEY) || "{}");
    const entry = cache[url];
    if (!entry || Date.now() - entry.ts > PVGIS_CACHE_TTL_MS) return null;
    return entry.data;
  } catch (e) {
    return null;
  }
}

function pvgisCacheSet(url, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(PVGIS_CACHE_KEY) || "{}");
    cache[url] = { ts: Date.now(), data };
    const keys = Object.keys(cache);
    if (keys.length > PVGIS_CACHE_MAX_ENTRIES) {
      keys.sort((a, b) => cache[a].ts - cache[b].ts);
      delete cache[keys[0]];
    }
    localStorage.setItem(PVGIS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // localStorage переповнений/недоступний — просто працюємо без кешу.
  }
}

// Спільна функція для panels.js і production.js: спочатку дивиться в кеш,
// потім пробує звернутись до PVGIS напряму (майже завжди провалиться через
// CORS у браузері), і лише як фолбек — через усі проксі зі списку ОДНОЧАСНО
// (паралельно, а не по черзі одне за одним) — перемагає перший, хто дасть
// коректну відповідь. З файлу відкритого локально (file://) PVGIS сам буває
// повільним (це державний науковий сервіс ЄС), тому таймаут на кожну спробу —
// 20с; але оскільки всі проксі йдуть паралельно, загальне очікування в
// найгіршому разі теж ~20с, а не сума тайм-аутів усіх по черзі. Кожна спроба
// логується в консоль браузера (F12). Якщо провалились УСІ — підсумкова
// помилка містить коротку причину по кожній спробі, щоб можна було зрозуміти
// причину без відкриття DevTools (досить прочитати повідомлення на екрані).
const PVGIS_TIMEOUT_MS = 20000;

async function fetchPvgisJson(url) {
  const cached = pvgisCacheGet(url);
  if (cached) {
    console.log("[PVGIS] з кешу (localStorage)");
    return cached;
  }

  async function tryOne(label, fetchUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PVGIS_TIMEOUT_MS);
      let r;
      try {
        r = await fetch(fetchUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error("відповідь не JSON (" + text.slice(0, 80).replace(/\s+/g, " ") + ")");
      }
      console.log("[PVGIS] " + label + ": OK");
      return data;
    } catch (e) {
      const msg =
        e && e.name === "AbortError" ? "таймаут " + PVGIS_TIMEOUT_MS / 1000 + "с" : e && e.message ? e.message : String(e);
      throw new Error(label + ": " + msg);
    }
  }

  const attempts = [];

  try {
    const data = await tryOne("напряму", url);
    pvgisCacheSet(url, data);
    return data;
  } catch (e) {
    attempts.push(e.message);
  }

  const proxyAttempts = PVGIS_PROXIES.map((proxy) => tryOne("проксі " + proxy.split("/")[2], proxy + encodeURIComponent(url)));
  try {
    const data = await Promise.any(proxyAttempts);
    pvgisCacheSet(url, data);
    return data;
  } catch (aggregateErr) {
    (aggregateErr.errors || []).forEach((e) => attempts.push(e.message));
    console.warn("[PVGIS] усі спроби провалились:", attempts);
    throw new Error(attempts.join(" | "));
  }
}

// Чи можна вибрати кут кріплень (регульовані стійки, 15/20/30°), чи панелі
// монтуються впритул до існуючого схилу даху (кут = кут ската даху, він
// невідомий без виїзду на об'єкт — тому нічого не рахуємо і не показуємо як
// конкретне число). Визначається типом даху, обраним на вкладці «Калькулятор»
// (поле adjustableTilt у Дані!roofTypes, керується на вкладці «Дані»).
//
// Якщо в браузері вже збережені старі відредаговані Дані (localStorage, ще
// без поля adjustableTilt), поточний roofTypes може не мати цього поля —
// тоді підстраховуємось і дивимось той самий тип даху в "заводському"
// DEFAULT_DATA (він завжди свіжий, бо не зберігається в localStorage).
function isRoofAdjustable() {
  const app = window.SesApp;
  if (!app) return true;
  const data = app.getData ? app.getData() : null;
  const r = app.getLastResult ? app.getLastResult() : null;
  if (!data || !r || !r.input) return true;

  const roof = data.roofTypes.find((x) => x.name === r.input.roofType);
  if (roof && typeof roof.adjustableTilt === "boolean") {
    return roof.adjustableTilt;
  }

  // Поля нема (стара збережена версія Дані) — питаємо DEFAULT_DATA за назвою.
  const defList = typeof DEFAULT_DATA !== "undefined" ? DEFAULT_DATA.roofTypes : [];
  const def = defList.find((x) => x.name === r.input.roofType);
  const result = !def || def.adjustableTilt !== false;
  console.log(
    "[isRoofAdjustable] '" + r.input.roofType + "': поле відсутнє в збережених Дані, фолбек на DEFAULT_DATA →",
    result
  );
  return result;
}

const PANEL_SPEC = {
  lengthM: 2.382,
  widthM: 1.134,
  wattPerPanel: 620,
  gapM: 0.02,
  setbackM: 0.3,
};

const LAST_ADDR_KEY = "ses_last_address";

(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    const el = (id) => document.getElementById(id);

    if (!MAPS_API_KEY) {
      el("panels-no-key").style.display = "";
      el("panels-tool").style.display = "none";
      return;
    }

    let map, geocoder, roofPolygon, panelOverlays = [];
    let roofM = [];       // контур даху в метрах
    let panelsM = [];     // кути обраних панелей у метрах (та сама система координат, що roofM)
    let origin = null;    // {lat,lng} — перша точка контуру, початок координат для метрів
    let drawing = false;
    let optTilt = null;
    let tiltPromise = null; // проміс запиту кута нахилу (PVGIS/фолбек) — щоб savePng міг його дочекатись

    function setResult(text) {
      el("pn-result").textContent = text;
    }

    document.addEventListener("ses:maps-auth-failure", () => {
      setResult("Помилка ключа Maps API (невірний або обмежений ключ).");
    });

    function initMap() {
      try {
        const center = { lat: 50.4501, lng: 30.5234 };
        map = new google.maps.Map(el("pn-map"), {
          center,
          zoom: 19,
          mapTypeId: "satellite",
          tilt: 0,
          gestureHandling: "greedy",
          disableDoubleClickZoom: true,
        });
        geocoder = new google.maps.Geocoder();

        map.addListener("click", (e) => {
          if (drawing && roofPolygon) {
            roofPolygon.getPath().push(e.latLng);
            if (roofPolygon.getPath().getLength() >= 3) layout();
          }
        });
        map.addListener("dblclick", () => {
          if (drawing) finishDraw();
        });

        prefillFromCalc();
      } catch (e) {
        setResult("Помилка ініціалізації карти: " + e.message);
      }
    }

    // Підтягує координати/адресу і ціль по панелях з калькулятора. Викликається
    // і одразу після ініціалізації карти, і щоразу при перемиканні на цю вкладку
    // (щоб спрацювало, навіть якщо менеджер вписав координати ПІСЛЯ першого
    // відкриття сторінки).
    function prefillFromCalc() {
      const fromCalc = window.SesApp ? window.SesApp.getCoordsText() : "";
      const remembered = fromCalc || localStorage.getItem(LAST_ADDR_KEY) || "";
      if (remembered && remembered !== el("pn-addr").value) {
        el("pn-addr").value = remembered;
        findAddress();
      }

      const lastResult = window.SesApp ? window.SesApp.getLastResult() : null;
      if (lastResult && lastResult.panelCount) {
        el("pn-target").value = lastResult.panelCount;
      }
    }

    document.querySelectorAll('.tab-btn[data-tab="panels"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (map) prefillFromCalc();
        // Тип даху на калькуляторі могли поміняти, поки менеджер був на іншій
        // вкладці — раніше показаний тут кут (чи його відсутність) міг
        // застаріти. ensureTilt() сам звірить, чи "регульованість" кута
        // відтоді не змінилась, і за потреби порахує/приховає заново.
        ensureTilt();
      });
    });

    SesMapsLoader.ensure(MAPS_API_KEY, initMap);

    function rememberAddress(addr) {
      addr = String(addr || "").trim();
      if (addr) localStorage.setItem(LAST_ADDR_KEY, addr);
    }

    function findAddress() {
      const a = el("pn-addr").value.trim();
      if (!a) return;
      const toks = a.match(/-?\d+(?:[.,]\d+)?/g);
      if (toks && toks.length >= 2) {
        const lat = parseFloat(toks[0].replace(",", "."));
        const lng = parseFloat(toks[1].replace(",", "."));
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          map.setCenter({ lat, lng });
          map.setZoom(20);
          rememberAddress(a);
          return;
        }
      }
      geocoder.geocode({ address: a }, (results, status) => {
        if (status === "OK" && results[0]) {
          map.setCenter(results[0].geometry.location);
          map.setZoom(20);
          rememberAddress(a);
        } else {
          alert("Адресу не знайдено: " + status + ". Спробуйте ввести координати, напр. 50.4501, 30.5234");
        }
      });
    }

    function clearPanelOverlays() {
      panelOverlays.forEach((p) => p.setMap(null));
      panelOverlays = [];
    }

    function clearAll() {
      drawing = false;
      clearPanelOverlays();
      if (roofPolygon) {
        roofPolygon.setMap(null);
        roofPolygon = null;
      }
      roofM = [];
      panelsM = [];
      optTilt = null;
      tiltPromise = null;
      el("pn-tiltinfo").textContent = "";
      setResult("—");
    }

    function startDraw() {
      if (!map) return setResult("Карта ще не завантажилась.");
      clearAll();
      roofPolygon = new google.maps.Polygon({
        map,
        paths: [[]],
        fillColor: "#ffcc00",
        fillOpacity: 0.12,
        strokeColor: "#ffcc00",
        strokeWeight: 3,
        editable: true,
        clickable: false,
      });
      google.maps.event.addListener(roofPolygon.getPath(), "set_at", layout);
      google.maps.event.addListener(roofPolygon.getPath(), "insert_at", layout);
      drawing = true;
      setResult("Клікайте по кутах даху, потім «Готово».");
    }

    function finishDraw() {
      drawing = false;
      if (!roofPolygon || roofPolygon.getPath().getLength() < 3) {
        setResult("Потрібно щонайменше 3 кути.");
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      roofPolygon.getPath().getArray().forEach((ll) => bounds.extend(ll));
      map.fitBounds(bounds, 40);
      layout();
      tiltPromise = fetchTilt(bounds.getCenter());
    }

    // Гарантує, що кут нахилу порахований (або хоча б фолбек) ПЕРЕД збереженням
    // картинки — раніше PNG міг зберегтися без підпису кута, якщо натиснути
    // «Зберегти PNG» одразу після «Готово», не чекаючи відповіді PVGIS/проксі
    // (запит асинхронний і може тривати кілька секунд). Також підстраховує
    // випадок, коли кут взагалі не запитувався (наприклад, розкладку міняли
    // лише кнопкою «Розкласти» без повторного натискання «Готово»).
    async function ensureTilt() {
      // Тип даху на калькуляторі могли поміняти ПІСЛЯ того, як кут уже
      // порахувався для попереднього типу (кешований optTilt) — якщо
      // "регульованість" кута відтоді змінилась, кеш більше не дійсний і
      // треба порахувати заново, а не віддавати старе значення.
      if (optTilt && optTilt.adjustable === isRoofAdjustable()) return;
      if (!roofPolygon || roofPolygon.getPath().getLength() < 3) return;
      const bounds = new google.maps.LatLngBounds();
      roofPolygon.getPath().getArray().forEach((ll) => bounds.extend(ll));
      tiltPromise = fetchTilt(bounds.getCenter());
      await tiltPromise;
    }

    async function fetchTilt(center) {
      const adjustable = isRoofAdjustable();
      if (!adjustable) {
        // Скатний дах/черепиця/бітумна черепиця — панелі йдуть впритул до
        // існуючого схилу даху, стійок з вибором кута тут немає, і ціна за
        // такий тип даху вже це враховує. Мережу взагалі не смикаємо, і
        // жодного рядка про кут не показуємо (ні в інтерфейсі, ні на PNG) —
        // за проханням Anna: для цих типів даху питання кута просто зайве.
        optTilt = { ok: true, flush: true, slope: null, rawSlope: null, azimuth: null, adjustable: false };
        el("pn-tiltinfo").textContent = "";
        return;
      }
      el("pn-tiltinfo").textContent = "Рахую кут нахилу...";
      const lat = center.lat();
      const lon = center.lng();
      const url =
        "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=" +
        encodeURIComponent(lat) +
        "&lon=" +
        encodeURIComponent(lon) +
        "&peakpower=1&loss=14&optimalangles=1&outputformat=json";

      try {
        const data = await fetchPvgisJson(url);
        const ms = data.inputs && data.inputs.mounting_system && data.inputs.mounting_system.fixed;
        const slope = ms && ms.slope && typeof ms.slope.value === "number" ? ms.slope.value : null;
        const azimuth = ms && ms.azimuth && typeof ms.azimuth.value === "number" ? ms.azimuth.value : 0;
        if (slope === null) throw new Error("Немає slope у відповіді PVGIS");
        optTilt = {
          ok: true,
          rawSlope: Math.round(slope),
          slope: SesGeometry.snapToAllowedTilt(slope),
          azimuth: Math.round(azimuth),
          adjustable: true,
        };
      } catch (e) {
        // PVGIS недоступний (навіть через проксі, якщо він заданий) — рахуємо орієнтовно за широтою.
        const raw = SesGeometry.fallbackTilt(lat);
        optTilt = { ok: false, rawSlope: raw, slope: SesGeometry.snapToAllowedTilt(raw), azimuth: 0, adjustable: true };
      }
      el("pn-tiltinfo").textContent =
        "Кут кріплень: " + optTilt.slope + "° (ідеал ≈" + optTilt.rawSlope + "°, на південь)" + (optTilt.ok ? "" : ", орієнтовно");
    }

    function layout() {
      if (!roofPolygon) return;
      clearPanelOverlays();
      const path = roofPolygon.getPath().getArray();
      if (path.length < 3) return;

      origin = { lat: path[0].lat(), lng: path[0].lng() };
      const mpd = SesGeometry.metersPerDegree(origin.lat);
      roofM = path.map((ll) => ({
        x: (ll.lng() - origin.lng) * mpd.x,
        y: (ll.lat() - origin.lat) * mpd.y,
      }));

      const angleDeg = parseFloat(el("pn-angle").value) || 0;
      const orientation = el("pn-orient").value;
      const targetVal = parseInt(el("pn-target").value, 10);
      const targetCount = targetVal > 0 ? targetVal : 0;

      const { selected, candidatesCount } = SesGeometry.layoutPanels({
        roofM,
        angleDeg,
        panelLengthM: PANEL_SPEC.lengthM,
        panelWidthM: PANEL_SPEC.widthM,
        orientation,
        gapM: PANEL_SPEC.gapM,
        setbackM: PANEL_SPEC.setbackM,
        targetCount,
      });

      panelsM = selected.map((c) => c.ws);
      selected.forEach((c) => {
        const latlngs = c.ws.map((p) => new google.maps.LatLng(origin.lat + p.y / mpd.y, origin.lng + p.x / mpd.x));
        const poly = new google.maps.Polygon({
          paths: latlngs,
          map,
          fillColor: "#1a73e8",
          fillOpacity: 0.55,
          strokeColor: "#0b3d91",
          strokeWeight: 1,
          clickable: false,
        });
        panelOverlays.push(poly);
      });

      const n = selected.length;
      const kw = Math.round((n * PANEL_SPEC.wattPerPanel) / 1000 * 10) / 10;
      let txt;
      if (targetCount > 0) {
        txt = n + " з " + targetCount + " потрібних · " + kw + " кВт";
        if (n < targetCount) txt += " — дах замалий (максимум " + candidatesCount + ")";
      } else {
        txt = n + " панелей · " + kw + " кВт";
      }
      setResult(txt);
    }

    function draw2D() {
      const W = 1000, H = 700, pad = 80;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const g = cv.getContext("2d");
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      roofM.forEach((p) => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      });

      // Область для розкладки — прямокутник між заголовком/компасом (зверху) і
      // підписами кількості/кута (знизу), відступи зліва/справа = pad. Дах+панелі
      // масштабуються і ЦЕНТРУЮТЬСЯ в цій області (а не притискаються до кута),
      // щоб картинка виглядала охайно незалежно від пропорцій даху.
      const plotLeft = pad, plotRight = W - pad;
      const plotTop = 100, plotBottom = H - 95;
      const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
      const sc = Math.min((plotRight - plotLeft) / rangeX, (plotBottom - plotTop) / rangeY);
      const drawnW = rangeX * sc, drawnH = rangeY * sc;
      const offX = plotLeft + (plotRight - plotLeft - drawnW) / 2;
      const offY = plotTop + (plotBottom - plotTop - drawnH) / 2;
      const MX = (x) => offX + (x - minX) * sc;
      const MY = (y) => offY + drawnH - (y - minY) * sc;

      g.beginPath();
      roofM.forEach((p, i) => {
        const X = MX(p.x), Y = MY(p.y);
        if (i === 0) g.moveTo(X, Y);
        else g.lineTo(X, Y);
      });
      g.closePath();
      g.fillStyle = "#f4f6f6";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = "#05564D";
      g.stroke();

      panelsM.forEach((c) => {
        g.beginPath();
        c.forEach((p, i) => {
          const X = MX(p.x), Y = MY(p.y);
          if (i === 0) g.moveTo(X, Y);
          else g.lineTo(X, Y);
        });
        g.closePath();
        g.fillStyle = "#1a73e8";
        g.globalAlpha = 0.85;
        g.fill();
        g.globalAlpha = 1;
        g.lineWidth = 1;
        g.strokeStyle = "#0b3d91";
        g.stroke();
      });

      const n = panelsM.length;
      const kw = Math.round((n * PANEL_SPEC.wattPerPanel) / 1000 * 10) / 10;
      g.fillStyle = "#05564D";
      g.font = "bold 24px Arial";
      g.fillText("Орієнтовна розкладка панелей", pad, 46);

      // Компас: карта завжди північчю вгору (roofM рахується напряму з lat/lng без обертання).
      (function drawCompass() {
        const cx = W - 60, cy = 50, r = 22;
        g.save();
        g.strokeStyle = "#05564D";
        g.fillStyle = "#05564D";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, r, 0, 2 * Math.PI);
        g.stroke();
        g.beginPath();
        g.moveTo(cx, cy - r + 5);
        g.lineTo(cx - 6, cy + 5);
        g.lineTo(cx, cy - 2);
        g.lineTo(cx + 6, cy + 5);
        g.closePath();
        g.fill();
        g.textAlign = "center";
        g.font = "bold 13px Arial";
        g.fillText("N", cx, cy - r - 6);
        g.font = "11px Arial";
        g.fillText("S", cx, cy + r + 14);
        g.fillText("E", cx + r + 11, cy + 4);
        g.fillText("W", cx - r - 11, cy + 4);
        g.restore();
      })();

      g.fillStyle = "#222";
      g.font = "17px Arial";
      g.fillText(n + " панелей · " + kw + " кВт · панель " + PANEL_SPEC.lengthM + "×" + PANEL_SPEC.widthM + " м", pad, H - 26);

      if (optTilt && optTilt.flush) {
        // Скатний дах/черепиця/бітумна черепиця — питання кута тут зайве
        // (ціна вже враховує монтаж впритул до схилу), тому свідомо нічого
        // не пишемо про кут на цій картинці.
      } else if (optTilt && optTilt.slope) {
        g.fillStyle = "#05564D";
        g.font = "15px Arial";
        g.fillText(
          "Кут нахилу кріплень: " + optTilt.slope + "°, орієнтація на південь" + (optTilt.ok ? "" : " (орієнтовно)"),
          pad,
          H - 50
        );
      }

      return cv.toDataURL("image/png");
    }

    async function savePng() {
      if (!roofPolygon || !panelsM.length) {
        setResult("Спочатку розкладіть панелі.");
        return;
      }
      const n = panelsM.length;
      const kw = Math.round((n * PANEL_SPEC.wattPerPanel) / 1000 * 10) / 10;
      const prevResult = el("pn-result").textContent;
      setResult("Рахую кут нахилу...");
      await ensureTilt();
      setResult(prevResult);
      const dataUrl = draw2D();
      const client = (el("in-client") && el("in-client").value.trim()) || (el("pn-addr").value || "об'єкт").substring(0, 40);
      const safeName = String(client).replace(/[\/\\]/g, "-").trim();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${safeName} — розкладка ${n} пан ${kw} кВт.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // ---- Прив'язка кнопок ----
    el("pn-find").addEventListener("click", findAddress);
    el("pn-draw").addEventListener("click", startDraw);
    el("pn-finish").addEventListener("click", finishDraw);
    el("pn-clear").addEventListener("click", clearAll);
    el("pn-layout").addEventListener("click", layout);
    el("pn-save").addEventListener("click", savePng);
    el("pn-angle").addEventListener("input", () => {
      el("pn-angle-val").textContent = el("pn-angle").value + "°";
      layout();
    });
    el("pn-orient").addEventListener("change", layout);
    el("pn-target").addEventListener("input", layout);
    el("pn-addr").addEventListener("keydown", (e) => {
      if (e.key === "Enter") findAddress();
    });
  });
})();
