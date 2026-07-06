// geometry.js — чиста геометрія розкладки панелей (без залежності від Google Maps
// API, тому легко тестується). Все рахується у плоских метрах (x=схід, y=північ)
// відносно першої точки контуру даху. Портовано з Панелі_AppsScript.gs.

(function (root) {

  // Скільки метрів в одному градусі широти/довготи в даній точці (пласка апроксимація,
  // достатня для розміру одного даху).
  function metersPerDegree(lat) {
    return { x: 111320 * Math.cos((lat * Math.PI) / 180), y: 110540 };
  }

  function rotate(p, angleRad) {
    const c = Math.cos(angleRad),
      s = Math.sin(angleRad);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  // Точка в межах багатокутника (ray casting).
  function pointInPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y;
      const xj = poly[j].x,
        yj = poly[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * @param {Object} p
   * @param {Array<{x:number,y:number}>} p.roofM   контур даху в метрах (перша точка — початок координат)
   * @param {number} p.angleDeg     кут рядів, градуси
   * @param {number} p.panelLengthM довга сторона панелі, м
   * @param {number} p.panelWidthM  коротка сторона панелі, м
   * @param {"port"|"land"} p.orientation  вертикально/горизонтально
   * @param {number} p.gapM        зазор між панелями, м
   * @param {number} p.setbackM    відступ від краю даху, м
   * @param {number} p.targetCount ціль (0/невизначено = покрити весь дах)
   * @returns {{selected: Array, candidatesCount: number}}
   *   selected[i].ws — 4 кути панелі в тих самих метрах, що roofM (реальна орієнтація, без повороту)
   */
  function layoutPanels(p) {
    const ang = (p.angleDeg * Math.PI) / 180;
    const land = p.orientation === "land";
    const cw = land ? p.panelLengthM : p.panelWidthM;
    const ch = land ? p.panelWidthM : p.panelLengthM;
    const sx = cw + p.gapM,
      sy = ch + p.gapM;

    const rp = p.roofM.map((pt) => rotate(pt, -ang));
    let minx = Infinity,
      miny = Infinity,
      maxx = -Infinity,
      maxy = -Infinity;
    rp.forEach((pt) => {
      minx = Math.min(minx, pt.x);
      miny = Math.min(miny, pt.y);
      maxx = Math.max(maxx, pt.x);
      maxy = Math.max(maxy, pt.y);
    });
    minx += p.setbackM;
    miny += p.setbackM;
    maxx -= p.setbackM;
    maxy -= p.setbackM;

    let guard = 0,
      rowIdx = 0;
    const candidates = [];
    for (let y = miny; y + ch <= maxy && guard < 5000; y += sy, rowIdx++) {
      for (let x = minx; x + cw <= maxx && guard < 5000; x += sx) {
        guard++;
        const corners = [
          { x: x, y: y },
          { x: x + cw, y: y },
          { x: x + cw, y: y + ch },
          { x: x, y: y + ch },
        ];
        const ws = corners.map((pt) => rotate(pt, ang)); // назад у реальний (непровернутий) простір roofM
        const ok = ws.every((pt) => pointInPolygon(pt, p.roofM));
        if (ok) {
          const avgY = (ws[0].y + ws[1].y + ws[2].y + ws[3].y) / 4;
          candidates.push({ row: rowIdx, x: x, ws: ws, avgY: avgY });
        }
      }
    }

    const rows = {};
    candidates.forEach((c) => {
      (rows[c.row] = rows[c.row] || []).push(c);
    });
    const rowKeys = Object.keys(rows);
    const rowAvg = {};
    rowKeys.forEach((k) => {
      rowAvg[k] = rows[k].reduce((s, c) => s + c.avgY, 0) / rows[k].length;
    });
    // Менше avgY = південніше (у північній півкулі) → такі ряди заповнюємо першими.
    rowKeys.sort((a, b) => rowAvg[a] - rowAvg[b]);

    const target = p.targetCount > 0 ? p.targetCount : candidates.length;
    const selected = [];
    for (let i = 0; i < rowKeys.length && selected.length < target; i++) {
      const arr = rows[rowKeys[i]].slice().sort((a, b) => a.x - b.x);
      for (let j = 0; j < arr.length && selected.length < target; j++) {
        selected.push(arr[j]);
      }
    }
    return { selected: selected, candidatesCount: candidates.length };
  }

  // ---- Кут нахилу кріплень ----
  const ALLOWED_TILTS = [15, 20, 30];

  function snapToAllowedTilt(deg) {
    for (let i = 0; i < ALLOWED_TILTS.length; i++) {
      if (deg <= ALLOWED_TILTS[i]) return ALLOWED_TILTS[i];
    }
    return ALLOWED_TILTS[ALLOWED_TILTS.length - 1];
  }

  // Проста емпірична формула на випадок, якщо PVGIS недоступний.
  function fallbackTilt(lat) {
    const a = Math.abs(lat);
    if (a < 25) return Math.round(a * 0.87);
    if (a <= 50) return Math.round(a * 0.76 + 3.1);
    return Math.round(a * 0.5 + 16.3);
  }

  const api = {
    metersPerDegree,
    rotate,
    pointInPolygon,
    layoutPanels,
    ALLOWED_TILTS,
    snapToAllowedTilt,
    fallbackTilt,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SesGeometry = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
