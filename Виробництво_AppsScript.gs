/**
 * Інструмент «Виробництво електроенергії» (орієнтир для клієнта).
 * Показує помісячний графік і річне вироблення станції для адреси клієнта —
 * дані з PVGIS (безкоштовно, без ключа, покриває Україну).
 *
 * Самостійний інструмент, окремий від КП і від Розкладки панелей — жодних
 * автоматичних склеювань, менеджер сам зберігає й додає картинку до листа клієнту.
 *
 * УСТАНОВКА:
 * 1) Встав цей файл ОКРЕМИМ файлом у той самий проєкт Apps Script, де вже лежать
 *    КП_AppsScript.gs і Панелі_AppsScript.gs (Розширення → Apps Script → «+» → Script).
 * 2) У onOpen (у КП_AppsScript.gs) вже доданий пункт меню
 *    «📊 Виробництво електроенергії» → openProductionTool.
 * 3) Нічого додатково встановлювати не треба — інструмент використовує вбудований
 *    у Apps Script геокодер (Maps.newGeocoder()), ключ Maps API йому не потрібен.
 *
 * Використовує спільні речі з Панелі_AppsScript.gs (той самий проєкт, спільний простір
 * імен): getClientAddress_(), getNestedFolder_(), PANEL_COUNT_CELL. Тут їх не дублюємо.
 */
 
var PROD_IMG_FOLDER = 'КП/Виробництво'; // тека на Диску для збережених графіків
 
// Разова авторизація для нового користувача/девайса. Запустити ОДИН РАЗ кнопкою
// Run прямо в редакторі Apps Script (обери authorizeProduction у списку функцій),
// підтвердити запит доступу від Google. Це потрібно, бо з модального вікна
// (де відкривається сам інструмент) запит на новий дозвіл не спливає — і
// «Рахую...» просто зависає назавжди без жодної помилки.
function authorizeProduction() {
  try {
    UrlFetchApp.fetch(
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=50.45&lon=30.52&peakpower=1&loss=14&outputformat=json',
      { muteHttpExceptions: true });
  } catch (e) {}
  try { Maps.newGeocoder().geocode('Kyiv'); } catch (e) {}
  Logger.log('Авторизація виконана (або вже була надана раніше). Спробуй «Виробництво» знову.');
}
 
// Пікова потужність станції (кВт) для розрахунку виробітку.
// Пріоритет: кількість панелей × 620 Вт (реальна DC-потужність масиву, PANEL_COUNT_CELL з
// Панелі_AppsScript.gs); якщо порожньо — потужність інвертора (C22).
function getStationPeakKw_() {
  try {
    var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
    if (!calc) return 0;
    var panels = Number(calc.getRange(PANEL_COUNT_CELL).getValue());
    if (isFinite(panels) && panels > 0) return Math.round(panels * 0.62 * 100) / 100;
    var inv = Number(calc.getRange('C22').getValue());
    return (isFinite(inv) && inv > 0) ? inv : 0;
  } catch (e) { return 0; }
}
 
// Відкриває вікно з формою і графіком. Прив'язати до пункту меню
// «📊 Виробництво електроенергії».
function openProductionTool() {
  var html = HtmlService.createHtmlOutput(buildProductionHtml_())
    .setWidth(820).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Виробництво електроенергії');
}
 
function buildProductionHtml_() {
  var addr = getEffectiveAddress_();
  var kw = getStationPeakKw_();
  var cfg = JSON.stringify({ addr: addr, kw: kw });
  return PRODUCTION_HTML_TEMPLATE.replace('__CFG__', function () { return cfg; });
}
 
// Розбирає рядок вигляду "50.45, 30.52" на координати; повертає null, якщо це не координати.
function parseLatLng_(s) {
  var m = String(s).match(/(-?\d+(?:[.,]\d+)?)[,\s]+(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  var lat = parseFloat(m[1].replace(',', '.'));
  var lng = parseFloat(m[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: lat, lng: lng };
}
 
// Головна функція, яку викликає вікно: адреса/координати + потужність -> дані для графіка.
// Геокодинг — вбудованим сервісом Apps Script (Maps.newGeocoder), ключ не потрібен.
function calcProduction(addressOrCoords, kw) {
  try {
    saveLastAddress(addressOrCoords);
    var latlng = parseLatLng_(addressOrCoords);
    if (!latlng) {
      var geo = Maps.newGeocoder().geocode(addressOrCoords);
      if (!geo || !geo.results || !geo.results.length) throw new Error('Адресу не знайдено');
      var loc = geo.results[0].geometry.location;
      latlng = { lat: loc.lat, lng: loc.lng };
    }
    var out = getPvOutput_(latlng.lat, latlng.lng, kw);
    out.lat = latlng.lat;
    out.lng = latlng.lng;
    return out;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
 
// Один виклик PVGIS PVcalc; angleQS — доп. параметри кута (наприклад
// "&optimalangles=1" або "&angle=20&aspect=0"). Повертає розібрані місяці/рік/кут.
function fetchPvgis_(lat, lon, pk, angleQS) {
  var url = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=' + encodeURIComponent(lat) +
    '&lon=' + encodeURIComponent(lon) + '&peakpower=' + encodeURIComponent(pk) +
    '&loss=14' + angleQS + '&outputformat=json';
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
  var data = JSON.parse(resp.getContentText());
  var months = data.outputs && data.outputs.monthly && data.outputs.monthly.fixed;
  var totals = data.outputs && data.outputs.totals && data.outputs.totals.fixed;
  if (!months || !totals) throw new Error('Немає даних у відповіді PVGIS');
  var byMonth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  months.forEach(function (m) {
    var idx = Number(m.month) - 1;
    if (idx >= 0 && idx < 12) byMonth[idx] = Math.round(m.E_m);
  });
  var ms = data.inputs && data.inputs.mounting_system && data.inputs.mounting_system.fixed;
  var slope = (ms && ms.slope && typeof ms.slope.value === 'number') ? Math.round(ms.slope.value) : null;
  return { monthly: byMonth, annual: Math.round(totals.E_y), slope: slope };
}
 
// Запит до PVGIS: помісячне і річне вироблення. Рахуємо ДВІЧІ:
// 1) з optimalangles=1 — щоб дізнатись ідеальний кут (лише для довідки);
// 2) з реальним кутом наших кріплень (snapToAllowedTilt_ — 15/20/30°, спільна
// функція з Панелі_AppsScript.gs), aspect=0 — фасад завжди на південь.
// Річне/помісячне вироблення в результаті — саме під реальний кут кріплень.
function getPvOutput_(lat, lon, kw) {
  try {
    var pk = (Number(kw) > 0) ? Number(kw) : 1;
    var ideal = fetchPvgis_(lat, lon, pk, '&optimalangles=1');
    var mountSlope = (ideal.slope != null) ? snapToAllowedTilt_(ideal.slope) : 20;
    var real = fetchPvgis_(lat, lon, pk, '&angle=' + mountSlope + '&aspect=0');
    return {
      ok: true, monthly: real.monthly, annual: real.annual, kw: pk,
      slope: mountSlope, rawSlope: ideal.slope, azimuth: 0
    };
  } catch (e) {
    return { ok: false, error: String(e), kw: Number(kw) || 0 };
  }
}
 
// Зберігає PNG-графік на Диск. Ім'я файлу — клієнт з калькулятора (C2), як і в решти інструментів.
function saveProductionPng(dataUrl, annual, title) {
  var b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  var bytes = Utilities.base64Decode(b64);
  var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
  var client = calc ? String(calc.getRange('C2').getDisplayValue()).trim() : '';
  var namePart = String(client || title || 'об\'єкт').replace(/[\/\\]/g, '-').trim();
  var blob = Utilities.newBlob(bytes, 'image/png',
    namePart + ' — виробництво ' + annual + ' кВт·год-рік.png');
  var folder = getNestedFolder_(PROD_IMG_FOLDER);
  var file = folder.createFile(blob);
  return { url: file.getUrl(), name: file.getName() };
}
 
// ----- HTML вікна (форма + canvas-графік) -----
var PRODUCTION_HTML_TEMPLATE = ''
+ '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
+ 'body{font-family:Arial,sans-serif;margin:0;font-size:13px;color:#222}'
+ '#bar{padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-bottom:1px solid #ddd;background:#fafafa}'
+ 'input,button{font-size:13px;padding:5px 7px}'
+ 'button{cursor:pointer;border:1px solid #05564D;background:#05564D;color:#fff;border-radius:4px}'
+ 'button.sec{background:#fff;color:#05564D}'
+ '#addr{width:260px}#kw{width:80px}'
+ '#res{font-weight:bold;color:#05564D;margin-left:auto}'
+ '.hint{color:#666;padding:6px 8px}'
+ '#wrap{padding:10px;text-align:center}'
+ 'canvas{max-width:100%;border:1px solid #eee}'
+ '</style></head><body>'
+ '<div id="bar">'
+ '<input id="addr" placeholder="Адреса або координати">'
+ '<label>Потужність, кВт <input id="kw" type="number" step="0.1" min="0"></label>'
+ '<button onclick="calcProd()">📊 Порахувати</button>'
+ '<button class="sec" onclick="save()">💾 Зберегти</button>'
+ '<span id="res">—</span>'
+ '</div>'
+ '<div class="hint">Адреса й потужність підтягнуті з калькулятора (можна поправити вручну). Дані з PVGIS — безкоштовно, ключ не потрібен.</div>'
+ '<div id="wrap"><canvas id="cv" width="760" height="460"></canvas></div>'
+ '<script>'
+ 'function setRes(t){var r=document.getElementById("res");if(r)r.textContent=t;}'
+ 'window.onerror=function(m,src,l){setRes("Помилка (JS): "+m+" (рядок "+l+")");return false;};'
+ 'var CFG={},lastData=null;'
+ 'try{CFG=__CFG__;}catch(e){setRes("Помилка конфігурації: "+e.message);}'
+ 'try{document.getElementById("addr").value=CFG.addr||"";'
+ '    document.getElementById("kw").value=CFG.kw||"";}catch(e){setRes("Помилка ініціалізації: "+e.message);}'
+ 'var MONTHS=["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];'
+ 'function calcProd(){'
+ ' try{'
+ '  var addr=document.getElementById("addr").value.trim();'
+ '  var kw=parseFloat(document.getElementById("kw").value)||0;'
+ '  if(!addr){setRes("Введи адресу або координати");return;}'
+ '  setRes("Рахую...");'
+ '  google.script.run.withSuccessHandler(function(r){'
+ '    if(!r||!r.ok){setRes("Помилка: "+(r&&r.error?r.error:"невідома")+". Спробуй ще раз або точні координати.");return;}'
+ '    lastData=r;drawChart(r);'

+ '    setRes(r.annual+" кВт\\u00b7год/рік"+(r.slope!=null?" \\u00b7 кут кріплень "+r.slope+"\\u00b0":""));'
+ '  }).withFailureHandler(function(e){setRes("Помилка: "+e.message);})'
+ '   .calcProduction(addr,kw);'
+ ' }catch(e){setRes("Помилка (calcProd): "+e.message);}'
+ '}'
+ 'function drawChart(r){'
+ '  var cv=document.getElementById("cv");var g=cv.getContext("2d");'
+ '  var W=cv.width,H=cv.height,padL=70,padR=20,padT=120,padB=50;'
+ '  g.clearRect(0,0,W,H);g.fillStyle="#ffffff";g.fillRect(0,0,W,H);'
+ '  g.fillStyle="#05564D";g.font="bold 20px Arial";'
+ '  g.fillText("Орієнтовне виробництво електроенергії",padL,32);'
+ '  g.fillStyle="#222";g.font="14px Arial";'
+ '  var sub="Станція "+r.kw+" кВт \\u00b7 Річне: "+r.annual+" кВт\\u00b7год/рік";'

+ '  if(r.slope!=null)sub+=" \\u00b7 кут кріплень "+r.slope+"\\u00b0, на південь";'
+ '  g.fillText(sub,padL,54);'
+ '  var vals=r.monthly,maxV=Math.max.apply(null,vals)||1;'
+ '  var chartW=W-padL-padR,chartH=H-padT-padB;'
+ '  var bw=chartW/vals.length*0.65,gap=chartW/vals.length;'
+ '  g.strokeStyle="#ccc";g.lineWidth=1;'
+ '  g.beginPath();g.moveTo(padL,padT);g.lineTo(padL,padT+chartH);g.lineTo(padL+chartW,padT+chartH);g.stroke();'
+ '  for(var i=0;i<vals.length;i++){'
+ '    var h=(vals[i]/maxV)*chartH;'
+ '    var x=padL+i*gap+(gap-bw)/2,y=padT+chartH-h;'
+ '    g.fillStyle="#1a73e8";g.fillRect(x,y,bw,h);'
+ '    g.fillStyle="#222";g.font="11px Arial";g.textAlign="center";'
+ '    g.fillText(MONTHS[i],x+bw/2,padT+chartH+18);'
+ '    g.fillText(String(vals[i]),x+bw/2,y-6);'
+ '  }'
+ '  g.textAlign="left";'
+ '}'
+ 'function save(){'
+ '  if(!lastData){setRes("Спочатку натисни «Порахувати».");return;}'
+ '  var cv=document.getElementById("cv");var data=cv.toDataURL("image/png");'
+ '  var title=(document.getElementById("addr").value||"обєкт").substring(0,40);'
+ '  setRes("Зберігаю...");'
+ '  google.script.run.withSuccessHandler(function(r){'
+ '    document.getElementById("res").innerHTML=lastData.annual+" кВт\\u00b7год/рік \\u2014 <a href=\\""+r.url+"\\" target=\\"_blank\\">картинка</a>";'
+ '  }).withFailureHandler(function(e){setRes("Помилка: "+e.message);})'
+ '   .saveProductionPng(data,lastData.annual,title);'
+ '}'
+ 'if(CFG.addr)calcProd();'
+ '</script>'
+ '</body></html>';
 

