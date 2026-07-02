/**
 * Інструмент «Розкладка панелей на даху» (орієнтир для клієнта).
 * Відкривається з меню таблиці, показує супутникову карту, менеджер обводить дах —
 * панелі розкладаються автоматично, рахується кількість і потужність.
 *
 * УСТАНОВКА:
 * 1) Встав цей файл у той самий проєкт Apps Script, де лежить КП-скрипт
 *    (Розширення → Apps Script → «+» → Script → встав код).
 * 2) Встав ключ Maps API в Налаштуваннях проєкту (⚙ Project Settings →
 *    Script Properties → MAPS_KEY = твій ключ). У коді ключ більше не зберігається.
 * 3) У існуючій функції onOpen (у КП-скрипті) додай один рядок у меню — див.
 *    файл «Шаг2_Установка_панели.md».
 */

// ====================== НАЛАШТУВАННЯ ======================
// Ключ Maps API зберігається ОКРЕМО від коду — у Властивостях скрипта,
// тож оновлення коду його НЕ стирає. Встав його один раз:
//   Apps Script → ⚙ Project Settings → Script Properties → Add script property
//   Property = MAPS_KEY,  Value = твій ключ (AIza...)  → Save.
function getMapsKey_() {
  return (PropertiesService.getScriptProperties().getProperty('MAPS_KEY') || '').trim();
}

var PANEL = {
  L_MM: 2382,   // довга сторона панелі, мм
  W_MM: 1134,   // коротка сторона панелі, мм
  WATT: 620,    // потужність панелі, Вт
  GAP_M: 0.02,  // зазор між панелями, м
  SETBACK_M: 0.3 // відступ від краю даху, м
};

var ADDRESS_CELL = 'C3';        // якщо хочеш підставляти адресу клієнта з калькулятора (необов'язково)
var PANEL_COUNT_CELL = 'C42';   // кількість панелей з калькулятора (Кріплення) — ціль для розкладки
var IMG_FOLDER   = 'КП/Розкладки'; // тека на Google Диску для збережених картинок
// ==========================================================

// Відкриває вікно з картою. Прив'язати до пункту меню «🗺️ Розкладка панелей».
function openPanelTool() {
  if (!getMapsKey_()) {
    SpreadsheetApp.getUi().alert(
      'Не задано ключ Maps API.\n\nApps Script → ⚙ Project Settings → Script Properties → ' +
      'Add script property: ім\'я MAPS_KEY, значення — твій ключ. Потім збережи і відкрий знову.');
    return;
  }
  var html = HtmlService.createHtmlOutput(buildPanelHtml_())
    .setWidth(960).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, 'Розкладка панелей на даху');
}

// Одноразова авторизація для нового користувача. Викликати з пункту меню
// «🔑 Авторизувати» — Google покаже запит дозволу (з вікна-діалогу він не з'являється).
function authorizeTool() {
  var name = DriveApp.getRootFolder().getName(); // дотик до Drive → тригерить дозвіл
  SpreadsheetApp.getUi().alert('Доступ надано (' + name + '). Тепер «Зберегти в КП» працюватиме.');
}

// Адреса клієнта з калькулятора (для автозаповнення поля пошуку).
function getClientAddress_() {
  try {
    var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
    return calc ? String(calc.getRange(ADDRESS_CELL).getDisplayValue()).trim() : '';
  } catch (e) { return ''; }
}

// Координати об'єкта (необов'язкове поле в калькуляторі — менеджер сам вписує
// "50.4501, 30.5234", якщо знає точну точку). Пріоритетніше за текстову адресу,
// бо не потребує геокодингу і не може "промахнутись" повз потрібне місце.
var COORDS_CELL = 'C9';

function getClientCoords_() {
  try {
    var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
    return calc ? String(calc.getRange(COORDS_CELL).getDisplayValue()).trim() : '';
  } catch (e) { return ''; }
}

// Спільна "пам'ять" адреси між інструментами (Розкладка панелей і Виробництво
// електроенергії). Пріоритет: координати з калькулятора (C9) → адреса з
// калькулятора (C3) → остання адреса/координати, введені вручну в БУДЬ-ЯКОМУ
// з цих двох вікон.
var LAST_ADDR_PROP = 'LAST_ADDR';

function getEffectiveAddress_() {
  var coords = getClientCoords_();
  if (coords) return coords;
  var a = getClientAddress_();
  if (a) return a;
  try { return PropertiesService.getDocumentProperties().getProperty(LAST_ADDR_PROP) || ''; }
  catch (e) { return ''; }
}

// Викликається з клієнтського коду обох інструментів після успішного пошуку
// адреси/координат — щоб вона "запам'ятовувалась" для іншого інструменту.
function saveLastAddress(addr) {
  try {
    addr = String(addr || '').trim();
    if (addr) PropertiesService.getDocumentProperties().setProperty(LAST_ADDR_PROP, addr);
  } catch (e) {}
}

// Кількість панелей з калькулятора (для автопідстановки цілі розкладки).
function getPanelTargetCount_() {
  try {
    var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
    if (!calc) return 0;
    var v = Number(calc.getRange(PANEL_COUNT_CELL).getValue());
    return (isFinite(v) && v > 0) ? Math.round(v) : 0;
  } catch (e) { return 0; }
}

// Кути, які фізично підтримують наші кріплення. Розрахунковий (ідеальний) кут
// завжди округлюється ВГОРУ до найближчого з цього списку.
var ALLOWED_TILTS = [15, 20, 30];

function snapToAllowedTilt_(deg) {
  for (var i = 0; i < ALLOWED_TILTS.length; i++) {
    if (deg <= ALLOWED_TILTS[i]) return ALLOWED_TILTS[i];
  }
  return ALLOWED_TILTS[ALLOWED_TILTS.length - 1]; // якщо ідеальний кут більший за максимум кріплення
}

// Оптимальний кут нахилу (і азимут) для точки — беремо з PVGIS (безкоштовний, без ключа,
// покриває Україну). Якщо сервіс недоступний — рахуємо орієнтовно за широтою.
// Підсумковий кут завжди підганяється під наявні кріплення (ALLOWED_TILTS).
function getOptimalTilt(lat, lon) {
  try {
    var url = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=' + encodeURIComponent(lat) +
      '&lon=' + encodeURIComponent(lon) + '&peakpower=1&loss=14&optimalangles=1&outputformat=json';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    var data = JSON.parse(resp.getContentText());
    var ms = data.inputs && data.inputs.mounting_system && data.inputs.mounting_system.fixed;
    var slope = ms && ms.slope && typeof ms.slope.value === 'number' ? ms.slope.value : null;
    var azimuth = ms && ms.azimuth && typeof ms.azimuth.value === 'number' ? ms.azimuth.value : null;
    if (slope === null) throw new Error('Немає slope у відповіді PVGIS');
    return { ok: true, rawSlope: Math.round(slope), slope: snapToAllowedTilt_(slope), azimuth: Math.round(azimuth || 0) };
  } catch (e) {
    var raw = fallbackTilt_(lat);
    return { ok: false, rawSlope: raw, slope: snapToAllowedTilt_(raw), azimuth: 0, error: String(e) };
  }
}

// Проста емпірична формула на випадок, якщо PVGIS недоступний.
function fallbackTilt_(lat) {
  var a = Math.abs(lat);
  if (a < 25) return Math.round(a * 0.87);
  if (a <= 50) return Math.round(a * 0.76 + 3.1);
  return Math.round(a * 0.5 + 16.3);
}

// Викликається з вікна: зберігає 2D-схему (PNG з canvas) на Диск.
function savePanelPng(dataUrl, count, kw, title) {
  var b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  var bytes = Utilities.base64Decode(b64);

  // Ім'я файлу — назва клієнта з калькулятора (C2), якщо задана; інакше — адреса
  // з поля пошуку в самому інструменті; інакше — просто «об'єкт».
  var calc = SpreadsheetApp.getActive().getSheetByName('Калькулятор');
  var client = calc ? String(calc.getRange('C2').getDisplayValue()).trim() : '';
  var namePart = String(client || title || 'об\'єкт').replace(/[\/\\]/g, '-').trim();

  var blob = Utilities.newBlob(bytes, 'image/png',
    namePart + ' — розкладка ' + count + ' пан ' + kw + ' кВт.png');
  var folder = getNestedFolder_(IMG_FOLDER);
  var file = folder.createFile(blob);

  // Розкладка — самостійний інструмент, окремий від КП. Картинка лягає тільки
  // на Диск у свою теку, у сам PDF КП вона більше не підтягується.
  return { url: file.getUrl(), name: file.getName() };
}

function getNestedFolder_(path) {
  var parts = path.split('/');
  var parent = DriveApp.getRootFolder();
  for (var i = 0; i < parts.length; i++) {
    var it = parent.getFoldersByName(parts[i]);
    parent = it.hasNext() ? it.next() : parent.createFolder(parts[i]);
  }
  return parent;
}

// ----- HTML вікна (карта + логіка розкладки) -----
function buildPanelHtml_() {
  var addr = getEffectiveAddress_();
  var target = getPanelTargetCount_();
  var cfg = JSON.stringify({
    L: PANEL.L_MM / 1000, W: PANEL.W_MM / 1000, WATT: PANEL.WATT,
    GAP: PANEL.GAP_M, SETBACK: PANEL.SETBACK_M, addr: addr, TARGET: target
  });
  var key = encodeURIComponent(getMapsKey_());
  // replace c функцией — чтобы спецсимволы ($ и т.п.) в адресе не ломали подстановку,
  // и /g — потому что __KEY__ встречается в шаблоне несколько раз.
  var html = HTML_TEMPLATE
    .replace(/__KEY__/g, function () { return key; })
    .replace('__CFG__', function () { return cfg; });
  return html;
}

var HTML_TEMPLATE = ''
+ '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
+ 'body{font-family:Arial,sans-serif;margin:0;font-size:13px;color:#222}'
+ '#bar{padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-bottom:1px solid #ddd;background:#fafafa;position:relative;z-index:5}'
+ '.hint{position:relative;z-index:5;background:#fff}'
+ '#map{width:100%;height:440px;position:relative;z-index:0}'
+ 'input,select,button{font-size:13px;padding:5px 7px}'
+ 'button{cursor:pointer;border:1px solid #05564D;background:#05564D;color:#fff;border-radius:4px}'
+ 'button.sec{background:#fff;color:#05564D}'
+ '#addr{width:280px}#res{font-weight:bold;color:#05564D;margin-left:auto}'
+ '.hint{color:#666;padding:4px 8px}'
+ '</style></head><body>'
+ '<div id="bar">'
+ '<input id="addr" placeholder="Адреса або координати">'
+ '<button class="sec" onclick="findAddr()">Знайти</button>'
+ '<button class="sec" onclick="startDraw()">✏️ Обвести дах</button>'
+ '<button class="sec" onclick="finishDraw()">✓ Готово</button>'
+ '<label>Кут рядів <input id="ang" type="range" min="0" max="180" value="0" oninput="ad();layout()"></label>'
+ '<span id="angv">0°</span>'
+ '<select id="orient" onchange="layout()"><option value="port">вертикально</option><option value="land">горизонтально</option></select>'
+ '<label>К-сть панелей <input id="target" type="number" min="0" style="width:64px" oninput="layout()"></label>'
+ '<button onclick="layout()">▦ Розкласти</button>'
+ '<button class="sec" onclick="clearAll()">Очистити</button>'
+ '<button onclick="save()">💾 Зберегти в КП</button>'
+ '<span id="tiltinfo" style="color:#05564D;font-weight:bold"></span>'
+ '<span id="res">—</span>'
+ '</div>'
+ '<div class="hint">Знайди адресу → «Обвести дах» (клікай по кутах даху, потім «Готово») → панелі розкладуться. Кількість підтягується з калькулятора (можна змінити вручну); ряди заповнюються з південного краю контуру — там, де сонця найбільше. Кутом рядів вирівняй їх вздовж схилу. Після «Готово» порахується орієнтовний кут нахилу панелей (PVGIS).</div>'
+ '<div id="map"></div>'
+ '<script>'
+ 'var CFG=__CFG__;var map,roof,geocoder,panels=[],panelsM=[],roofM=[],ready=false,drawing=false,optTilt=null;'
+ 'document.getElementById("target").value=(CFG.TARGET||"");'
+ 'function setRes(t){var r=document.getElementById("res");if(r)r.textContent=t;}'
+ 'window.onerror=function(m,src,l){setRes("Помилка: "+m+" (рядок "+l+")");return false;};'
+ 'window.gm_authFailure=function(){setRes("Помилка ключа Maps API (невірний або обмежений ключ)");};'
+ 'function initMap(){try{'
+ '  var c={lat:50.4501,lng:30.5234};'
+ '  map=new google.maps.Map(document.getElementById("map"),{center:c,zoom:19,mapTypeId:"satellite",tilt:0,gestureHandling:"greedy",disableDoubleClickZoom:true});'
+ '  if(!map){setRes("Карта не створилась");return;}'
+ '  geocoder=new google.maps.Geocoder();'
+ '  map.addListener("click",function(e){if(drawing&&roof){roof.getPath().push(e.latLng);if(roof.getPath().getLength()>=3)layout();}});'
+ '  map.addListener("dblclick",function(e){if(drawing)finishDraw();});'
+ '  ready=true;'
+ '  if(CFG.addr){document.getElementById("addr").value=CFG.addr;findAddr();}'
+ '}catch(e){setRes("initMap: "+e.message);}}'
+ 'function ad(){document.getElementById("angv").textContent=document.getElementById("ang").value+"\\u00b0";}'
+ 'function findAddr(){var a=document.getElementById("addr").value.trim();if(!a)return;'
+ '  var toks=a.match(/-?\\d+(?:[.,]\\d+)?/g);'
+ '  if(toks&&toks.length>=2){var lat=parseFloat(toks[0].replace(",","."));var lng=parseFloat(toks[1].replace(",","."));'
+ '    if(Math.abs(lat)<=90&&Math.abs(lng)<=180){map.setCenter({lat:lat,lng:lng});map.setZoom(20);google.script.run.saveLastAddress(a);return;}}'
+ '  geocoder.geocode({address:a},function(r,s){if(s==="OK"&&r[0]){map.setCenter(r[0].geometry.location);map.setZoom(20);google.script.run.saveLastAddress(a);}else{alert("Адресу не знайдено: "+s+". Спробуй ввести координати, напр. 50.4501, 30.5234");}});}'
+ 'function startDraw(){try{if(!map){setRes("Карта ще не завантажилась");return;}clearAll();'
+ '  roof=new google.maps.Polygon({map:map,paths:[[]],fillColor:"#ffcc00",fillOpacity:0.12,strokeColor:"#ffcc00",strokeWeight:3,editable:true,clickable:false});'
+ '  google.maps.event.addListener(roof.getPath(),"set_at",layout);'
+ '  google.maps.event.addListener(roof.getPath(),"insert_at",layout);'
+ '  drawing=true;'
+ '  setRes("Клікай по кутах даху, потім «Готово»");}catch(e){setRes("startDraw: "+e.message);}}'
+ 'function finishDraw(){drawing=false;if(roof&&roof.getPath().getLength()>=3){var b=new google.maps.LatLngBounds();roof.getPath().getArray().forEach(function(ll){b.extend(ll);});map.fitBounds(b,40);layout();fetchTilt_(b.getCenter());}else{setRes("Потрібно щонайменше 3 кути");}}'
+ 'function fetchTilt_(center){'
+ '  document.getElementById("tiltinfo").textContent="Рахую кут нахилу...";'
+ '  google.script.run.withSuccessHandler(function(r){'
+ '    optTilt=r;'
+ '    document.getElementById("tiltinfo").textContent="Кут кріплень: "+r.slope+"\\u00b0 (ідеал \\u2248"+r.rawSlope+"\\u00b0, на південь)"+(r.ok?"":", орієнтовно");'
+ '  }).withFailureHandler(function(e){optTilt=null;document.getElementById("tiltinfo").textContent="";})'
+ '   .getOptimalTilt(center.lat(),center.lng());'
+ '}'
+ 'function clearPanels(){panels.forEach(function(x){x.setMap(null)});panels=[];}'
+ 'function clearAll(){drawing=false;clearPanels();if(roof){roof.setMap(null);roof=null;}optTilt=null;document.getElementById("tiltinfo").textContent="";document.getElementById("res").textContent="—";}'
+ 'function mpd(lat){return{x:111320*Math.cos(lat*Math.PI/180),y:110540};}'
+ 'function rot(p,a){var c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};}'
+ 'function layout(){'
+ '  if(!roof)return;clearPanels();'
+ '  var path=roof.getPath().getArray();if(path.length<3)return;'
+ '  var o={lat:path[0].lat(),lng:path[0].lng()},M=mpd(o.lat);'
+ '  var ang=(+document.getElementById("ang").value)*Math.PI/180;'
+ '  var land=document.getElementById("orient").value==="land";'
+ '  var cw=(land?CFG.L:CFG.W),ch=(land?CFG.W:CFG.L);'
+ '  var sx=cw+CFG.GAP,sy=ch+CFG.GAP;'
+ '  roofM=path.map(function(ll){return {x:(ll.lng()-o.lng)*M.x,y:(ll.lat()-o.lat)*M.y};});'
+ '  var rp=roofM.map(function(p){return rot(p,-ang);});'
+ '  var minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;'
+ '  rp.forEach(function(p){minx=Math.min(minx,p.x);miny=Math.min(miny,p.y);maxx=Math.max(maxx,p.x);maxy=Math.max(maxy,p.y);});'
+ '  minx+=CFG.SETBACK;miny+=CFG.SETBACK;maxx-=CFG.SETBACK;maxy-=CFG.SETBACK;'
+ '  var guard=0,rowIdx=0,candidates=[];'
+ '  for(var y=miny;y+ch<=maxy&&guard<5000;y+=sy,rowIdx++){'
+ '    for(var x=minx;x+cw<=maxx&&guard<5000;x+=sx){guard++;'
+ '      var corners=[{x:x,y:y},{x:x+cw,y:y},{x:x+cw,y:y+ch},{x:x,y:y+ch}];'
+ '      var ws=corners.map(function(p){return rot(p,ang);});'
+ '      var lls=ws.map(function(w){return new google.maps.LatLng(o.lat+w.y/M.y,o.lng+w.x/M.x);});'
+ '      var ok=lls.every(function(ll){return google.maps.geometry.poly.containsLocation(ll,roof);});'
+ '      if(ok){var avgLat=(lls[0].lat()+lls[1].lat()+lls[2].lat()+lls[3].lat())/4;'
+ '        candidates.push({row:rowIdx,x:x,ws:ws,lls:lls,lat:avgLat});}'
+ '    }'
+ '  }'
+ '  var rows={};candidates.forEach(function(c){(rows[c.row]=rows[c.row]||[]).push(c);});'
+ '  var rowKeys=Object.keys(rows);'
+ '  rowKeys.forEach(function(k){var arr=rows[k],s=0;arr.forEach(function(c){s+=c.lat;});arr._avg=s/arr.length;});'
// менша широта = південніше (Україна — північна півкуля) → такі ряди заповнюємо першими
+ '  rowKeys.sort(function(a,b){return rows[a]._avg-rows[b]._avg;});'
+ '  var tv=parseInt(document.getElementById("target").value,10);'
+ '  var target=(tv>0)?tv:candidates.length;'
+ '  var selected=[];'
+ '  for(var i=0;i<rowKeys.length&&selected.length<target;i++){'
+ '    var arr=rows[rowKeys[i]].slice().sort(function(a,b){return a.x-b.x;});'
+ '    for(var j=0;j<arr.length&&selected.length<target;j++)selected.push(arr[j]);'
+ '  }'
+ '  panelsM=[];'
+ '  selected.forEach(function(c){var pp=new google.maps.Polygon({paths:c.lls,map:map,fillColor:"#1a73e8",fillOpacity:0.55,strokeColor:"#0b3d91",strokeWeight:1,clickable:false});panels.push(pp);panelsM.push(c.ws);});'
+ '  var n=selected.length,kw=Math.round(n*CFG.WATT/1000*10)/10;'
+ '  var txt;'
+ '  if(tv>0){txt=n+" з "+tv+" потрібних \\u00b7 "+kw+" кВт";if(n<tv)txt+=" \\u2014 дах замалий (максимум "+candidates.length+")";}'
+ '  else txt=n+" панелей \\u00b7 "+kw+" кВт";'
+ '  document.getElementById("res").textContent=txt;'
+ '}'
+ 'function draw2D(){'
+ '  var W=1000,H=700,pad=80;'
+ '  var cv=document.createElement("canvas");cv.width=W;cv.height=H;var g=cv.getContext("2d");'
+ '  g.fillStyle="#ffffff";g.fillRect(0,0,W,H);'
+ '  var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;'
+ '  roofM.forEach(function(p){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});'
+ '  var sc=Math.min((W-2*pad)/((maxX-minX)||1),(H-2*pad-30)/((maxY-minY)||1));'
+ '  function MX(x){return pad+(x-minX)*sc;}function MY(y){return H-pad-(y-minY)*sc;}'
+ '  g.beginPath();roofM.forEach(function(p,i){var X=MX(p.x),Y=MY(p.y);if(i===0)g.moveTo(X,Y);else g.lineTo(X,Y);});g.closePath();'
+ '  g.fillStyle="#f4f6f6";g.fill();g.lineWidth=3;g.strokeStyle="#05564D";g.stroke();'
+ '  panelsM.forEach(function(c){g.beginPath();c.forEach(function(p,i){var X=MX(p.x),Y=MY(p.y);if(i===0)g.moveTo(X,Y);else g.lineTo(X,Y);});g.closePath();g.fillStyle="#1a73e8";g.globalAlpha=0.85;g.fill();g.globalAlpha=1;g.lineWidth=1;g.strokeStyle="#0b3d91";g.stroke();});'
+ '  var n=panels.length,kw=Math.round(n*CFG.WATT/1000*10)/10;'
+ '  g.fillStyle="#05564D";g.font="bold 24px Arial";g.fillText("Орієнтовна розкладка панелей",pad,46);'
// компас: карта завжди orientована північчю вгору (roofM рахується напряму з lat/lng без обертання),
// тож просте N/S/E/W коло без додаткових обчислень коректно показує сторони світу.
+ '  (function(){var cx=W-60,cy=50,r=22;'
+ '    g.save();g.strokeStyle="#05564D";g.fillStyle="#05564D";g.lineWidth=2;'
+ '    g.beginPath();g.arc(cx,cy,r,0,2*Math.PI);g.stroke();'
+ '    g.beginPath();g.moveTo(cx,cy-r+5);g.lineTo(cx-6,cy+5);g.lineTo(cx,cy-2);g.lineTo(cx+6,cy+5);g.closePath();g.fill();'
+ '    g.textAlign="center";g.font="bold 13px Arial";g.fillText("N",cx,cy-r-6);'
+ '    g.font="11px Arial";g.fillText("S",cx,cy+r+14);g.fillText("E",cx+r+11,cy+4);g.fillText("W",cx-r-11,cy+4);'
+ '    g.restore();})();'
+ '  g.fillStyle="#222";g.font="17px Arial";'
+ '  g.fillText(n+" панелей  \\u00b7  "+kw+" кВт  \\u00b7  панель "+CFG.L+"\\u00d7"+CFG.W+" м",pad,H-26);'
+ '  if(optTilt&&optTilt.slope){'
+ '    g.fillStyle="#05564D";g.font="15px Arial";'
+ '    g.fillText("Кут нахилу кріплень: "+optTilt.slope+"\\u00b0 (ідеал \\u2248"+optTilt.rawSlope+"\\u00b0), орієнтація на південь"+(optTilt.ok?"":" (орієнтовно)"),pad,H-50);'
+ '  }'
+ '  return cv.toDataURL("image/png");'
+ '}'
+ 'function save(){try{'
+ '  if(!roof||!panelsM.length){setRes("Спочатку розклади панелі.");return;}'
+ '  var n=panels.length,kw=Math.round(n*CFG.WATT/1000*10)/10;'
+ '  setRes("Зберігаю...");'
+ '  var title=(document.getElementById("addr").value||"обєкт").substring(0,40);'
+ '  var data=draw2D();'
+ '  google.script.run.withSuccessHandler(function(r){document.getElementById("res").innerHTML=n+" пан \\u00b7 "+kw+" кВт \\u2014 <a href=\\""+r.url+"\\" target=\\"_blank\\">картинка</a>";})'
+ '    .withFailureHandler(function(e){setRes("Помилка: "+e.message);})'
+ '    .savePanelPng(data,n,kw,title);'
+ '}catch(e){setRes("save: "+e.message);}}'
+ '</script>'
+ '<script async defer src="https://maps.googleapis.com/maps/api/js?key=__KEY__&libraries=geometry&v=weekly&callback=initMap"></script>'
+ '</body></html>';
