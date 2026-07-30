/**
 * Генерация коммерческого предложения (КП) в PDF из листа «Калькулятор».
 *
 * Как установить: см. файл «КП_Инструкция_установки.md».
 *
 * Логика: скрипт ищет на листе «Калькулятор» подписи строк (метки) и берёт
 * значение из соседней справа ячейки. Поэтому точные адреса ячеек не важны —
 * скрипт продолжит работать, даже если вы сдвинете строки.
 */
 
// ====================== НАСТРОЙКИ ======================
var CFG = {
  CALC_SHEET: 'Калькулятор',   // имя листа с калькулятором
  KP_SHEET:   '_КП',           // служебный лист, куда верстается КП (создаётся автоматически)
  COMPANY:    'ESCORE — інсталяція сонячних станцій', // шапка КП (поправьте под себя)
  COMPANY_CONTACTS: 'тел.: +380 75 410 00 16   •   email: commercial@escore.com.ua',
  CURRENCY_SYMBOL: '$',
  BRAND_COLOR: '#05564D',      // цвет плашки заголовка (взят из логотипа ESCORE)
  // Куда складывать PDF. Пусто => создастся папка «КП» рядом, в корне Моего диска.
  FOLDER_NAME: 'КП'
};
 
// Метки, которые ищем на листе. Можно дописывать синонимы в массивы.
var LABELS = {
  monthly:    ['Месячное потребление', 'Місячне споживання'],
  type:       ['Тип станции', 'Тип станції'],
  location:   ['Расположение', 'Розташування'],
  payment:    ['Форма оплаты', 'Форма оплати'],
  autonomy:   ['Часы автономии', 'Години автономії'],
  power:      ['Целевая мощность', 'Цільова потужність'],
  inverter:   ['Подобранный инвертор', 'Підібраний інвертор', 'Інвертор DEYE'],
  priceKw:    ['Цена за кВт', 'Ціна за кВт'],
  powerForPrice: ['Мощность станции для цены', 'Потужність станції для ціни', 'Мощность станции'],
  rate:       ['Курс'],
  reqCap:     ['Підсумкова ємність АКБ', 'Требуемая ёмкость АКБ', 'Необхідна ємність АКБ', 'Требуемая емкость АКБ'],
  modCap:     ['Ёмкость одного модуля', 'Ємність одного модуля', 'Емкость одного модуля'],
  battQty:    ['Количество модулей', 'Кількість модулів', 'Кол-во модулей'],
  battModel:  ['Обрана модель', 'Выбранная модель', 'Модель АКБ'],
  total:      ['ИТОГО', 'РАЗОМ', 'Итого', 'Разом', 'Ориентировочная цена', 'Орієнтовна ціна']
};
 
// Прямые адреса ячеек на листе «Калькулятор» для расчёта цены.
// Если у вас номера строк отличаются — поправьте здесь.
var CELLS = {
  clientName:   'C2',   // название клиента (менеджер вписывает вручную)
  payment:      'C7',   // форма оплаты: «ПДВ» или «Готівка»
  stationPrice: 'C25',  // цена самой станции (без АКБ и креплений)
  akbVat:       'C38',  // комплект АКБ — з ПДВ
  akbCash:      'C39',  // комплект АКБ — без ПДВ (готівка)
  mountPrice:   'C45',  // крепления
  totalUsd:     'C48',  // ИТОГО, $  (станция + АКБ + крепления)
  totalUah:     'C49'   // ИТОГО, грн
};
// =======================================================
 
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📄 КП')
    .addItem('Сформувати КП (PDF)', 'generateProposalPDF')
    .addItem('🗺️ Розкладка панелей', 'openPanelTool')
    .addItem('📊 Виробництво електроенергії', 'openProductionTool')
    .addToUi();
}
 
// Главная функция — привязывается к кнопке.
function generateProposalPDF() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var calc = ss.getSheetByName(CFG.CALC_SHEET);
  if (!calc) { notify_(ss, 'Аркуш «' + CFG.CALC_SHEET + '» не знайдено.', ''); return; }
 
  var map = buildLabelMap_(calc);
  var v = function(key) { return findValue_(map, LABELS[key]); };
 
  var isHybrid = /гібр|гибр/i.test(String(v('type')));
 
  // Параметры для отображения (по меткам)
  var powerForPrice = toNum_(v('powerForPrice'));
  var priceKw       = toNum_(v('priceKw'));
  var rate          = toNum_(v('rate'));
 
  // --- РАСЧЁТ ЦЕНЫ (по конкретным ячейкам) ---
  var paymentRaw = cellVal_(calc, CELLS.payment);          // «ПДВ» / «Готівка»
  var isVat = /пдв|пдв|vat/i.test(paymentRaw);
 
  // Цена станции: из C25; если пусто — мощность × цена/кВт
  var stationPrice = toNum_(cellVal_(calc, CELLS.stationPrice));
  if (!stationPrice && powerForPrice && priceKw) stationPrice = powerForPrice * priceKw;
 
  // Комплект АКБ: C7=ПДВ → C38 (з ПДВ); C7=Готівка → C39 (без ПДВ)
  var akbRaw   = cellVal_(calc, isVat ? CELLS.akbVat : CELLS.akbCash);
  var akbPrice = toNum_(akbRaw);
 
  // Крепления (может быть числом или текстом «уточнить (наземная)»)
  var mountRaw   = cellVal_(calc, CELLS.mountPrice);
  var mountPrice = toNum_(mountRaw);
 
  // ИТОГО: берём из C48/C49; если пусто — суммируем сами
  var totalUsd = toNum_(cellVal_(calc, CELLS.totalUsd));
  if (!totalUsd) totalUsd = stationPrice + akbPrice + mountPrice;
  var totalUah = toNum_(cellVal_(calc, CELLS.totalUah));
  if (!totalUah && totalUsd && rate) totalUah = totalUsd * rate;
 
  // Верстаем КП на служебном листе
  var sh = ss.getSheetByName(CFG.KP_SHEET);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(CFG.KP_SHEET);
 
  var rows = [];
  var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Kyiv', 'dd.MM.yyyy');
  var num  = 'КП-' + Utilities.formatDate(new Date(), 'Europe/Kyiv', 'yyMMdd-HHmm');
 
  var client = cellVal_(calc, CELLS.clientName); // назва клієнта з C2
 
  rows.push(['', '']); // рядок під логотип (по центру зверху)
  rows.push(['КОМЕРЦІЙНА ПРОПОЗИЦІЯ', '']);
  rows.push([client ? client : '', '']); // назва клієнта під заголовком
  rows.push([CFG.COMPANY, '']);
  rows.push([CFG.COMPANY_CONTACTS, '']);
  rows.push(['', '']);
  rows.push(['№ ' + num, 'Дата: ' + date]);
  rows.push(['', '']);
 
  rows.push(['Параметри станції', '']);
  rows.push(['Тип станції', fmt_(v('type'))]);
  rows.push(['Розташування', fmt_(v('location'))]);
  rows.push(['Форма оплати', fmt_(v('payment'))]);
  rows.push(['Середнє денне споживання, кВт', fmt_(v('power') || powerForPrice)]);
  rows.push(['Інвертор DEYE, кВт', fmt_(v('inverter'))]);
 
  if (isHybrid) {
    rows.push(['', '']);
    rows.push(['Комплект АКБ (автономія)', '']);
    rows.push(['Години автономії', fmt_(v('autonomy'))]);
    rows.push(['Ємність комплекту АКБ, кВт·год', fmt_(v('reqCap'))]);
    if (v('battModel')) rows.push(['Модель АКБ', fmt_(v('battModel'))]);
    rows.push(['Ємність модуля, кВт·год', fmt_(v('modCap'))]);
    if (v('battQty')) rows.push(['Кількість модулів, шт', fmt_(v('battQty'))]);
  }
 
  rows.push(['', '']);
  rows.push(['Орієнтовна вартість', '']);
  rows.push(['Станція, ' + CFG.CURRENCY_SYMBOL, money_(stationPrice)]);
  if (isHybrid || akbPrice) {
    rows.push(['Комплект АКБ' + (isVat ? ' (з ПДВ)' : '') + ', ' + CFG.CURRENCY_SYMBOL, money_(akbPrice)]);
  }
  if (mountPrice) {
    rows.push(['Кріплення, ' + CFG.CURRENCY_SYMBOL, money_(mountPrice)]);
  } else if (mountRaw && !/^[—-]$/.test(mountRaw)) {
    rows.push(['Кріплення', mountRaw]); // напр. «уточнити (наземна)»
  }
  rows.push(['РАЗОМ, ' + CFG.CURRENCY_SYMBOL, money_(totalUsd)]);
  if (totalUah) rows.push(['РАЗОМ, грн (курс ' + fmt_(rate) + ')', money_(Math.round(totalUah))]);
 
  rows.push(['', '']);
  rows.push(['', '']);
  rows.push(['Примітка:', '']);
  rows.push(['', '']);
  rows.push(['• Дана комерційна пропозиція є попередньою та розрахована на основі даних, наданих замовником.', '']);
  rows.push(['', '']);
  rows.push(['• До вартості станції включено стандартний комплект кабельної продукції', '']);
  rows.push(['обв\'язки сонячних панелей та підключення до інвертора.', '']);
  rows.push(['', '']);
  rows.push(['• Прокладка кабелю від інвертора до точки підключення,', '']);
  
  rows.push(['(електрощитової/лічильника) до розрахунку не входить — її довжина та вартість', '']);
  rows.push(['визначаються після виїзду фахівця на об\'єкт або надання точної', '']);
  rows.push(['відстані та маршруту прокладки.', '']);
  rows.push(['', '']);
  rows.push(['• Остаточна комплектація обладнання, перелік матеріалів (включно з додатковим ', '']);
  rows.push(['кабелем, кріпленням, автоматикою) та підсумкова вартість', '']);
  rows.push(['можуть бути скориговані за результатами технічного огляду об\'єкта.', '']);
  ;
 
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  styleKp_(sh, rows.length);
// Обрезаем лист до фактических данных (2 столбца, rows.length строк),
// иначе PDF масштабируется на всю сетку 26×1000 и таблица уезжает влево
if (sh.getMaxColumns() > 2) sh.deleteColumns(3, sh.getMaxColumns() - 2);
if (sh.getMaxRows() > rows.length) sh.deleteRows(rows.length + 1, sh.getMaxRows() - rows.length);

  // Логотип по центру сверху (первая строка)
  if (LOGO_B64) {
    try {
      var logoBlob = Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'logo.png');
      var totalW = 340 + 220;           // суммарная ширина колонок КП
      var logoW = 360;                  // ширина логотипа в пикселях
      sh.setRowHeight(1, 84);
      sh.insertImage(logoBlob, 1, 1, Math.max(0, Math.round((totalW - logoW) / 2)), 8);
    } catch (e) { /* если логотип не вставился — продолжаем без него */ }
  }
 
  // Фиксируем изменения, иначе экспорт может вернуть ошибку 500
  SpreadsheetApp.flush();
  Utilities.sleep(800);
 
  // Экспорт в PDF
  var blob = exportSheetPdf_(ss, sh);
  var clientSafe = String(client || '').replace(/[\/\\]/g, '-').trim();
  blob.setName((clientSafe ? clientSafe + ' — ' : '') + num + ' — КП.pdf');
  var folder = getFolder_(CFG.FOLDER_NAME);
  var file = folder.createFile(blob);
 
  ss.deleteSheet(sh); // убираем служебный лист
 
  var url = file.getUrl();
  Logger.log('КП готово: ' + url);
 
  // Пытаемся показать диалог со ссылкой. Если UI недоступен (запуск из
  // редактора Apps Script) — показываем toast / пишем в лог, файл уже создан.
  var html = '<div style="font-family:Arial;font-size:14px">'
    + '<p>КП сформовано:</p>'
    + '<p><a href="' + url + '" target="_blank">📄 ' + file.getName() + '</a></p>'
    + '<p style="color:#666">Файл збережено на Google Диску в теці «' + CFG.FOLDER_NAME + '».</p>'
    + '</div>';
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html).setWidth(420).setHeight(180), 'Комерційна пропозиція');
  } catch (e) {
    notify_(ss, 'КП готове. Файл у теці «' + CFG.FOLDER_NAME + '» на Google Диску.', url);
  }
}
 
// ---------- ВСПОМОГАТЕЛЬНЫЕ ----------
 
// Сообщение пользователю, устойчивое к отсутствию UI (запуск из редактора).
function notify_(ss, msg, url) {
  try { SpreadsheetApp.getUi().alert(msg + (url ? '\n\n' + url : '')); return; } catch (e) {}
  try { ss.toast(msg, 'Комерційна пропозиція', 8); } catch (e) {}
  Logger.log(msg + (url ? ' ' + url : ''));
}
 
// Строит словарь: текст метки (col A..) -> значение (следующая непустая ячейка справа).
function buildLabelMap_(sheet) {
  var data = sheet.getDataRange().getDisplayValues();
  var map = [];
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    for (var c = 0; c < row.length; c++) {
      var label = String(row[c]).trim();
      if (!label) continue;
      // значение — первая непустая ячейка правее метки
      var val = '';
      for (var k = c + 1; k < row.length; k++) {
        if (String(row[k]).trim() !== '') { val = String(row[k]).trim(); break; }
      }
      map.push({ label: label, value: val });
    }
  }
  return map;
}
 
// Ищет первое значение по списку возможных меток (по вхождению подстроки).
function findValue_(map, labelList) {
  if (!labelList) return '';
  for (var i = 0; i < labelList.length; i++) {
    var want = labelList[i].toLowerCase();
    for (var j = 0; j < map.length; j++) {
      if (map[j].label.toLowerCase().indexOf(want) !== -1 && map[j].value !== '') {
        return map[j].value;
      }
    }
  }
  return '';
}
 
// Разбирает число из строки, корректно отличая разделитель тысяч от десятичного.
// Понимает: "$8,320" -> 8320; "1,666.7" -> 1666.7; "43 200" -> 43200; "44,30" -> 44.3.
function toNum_(s) {
  if (s === '' || s == null) return 0;
  s = String(s).replace(/[^0-9.,\-]/g, ''); // оставляем цифры, точку, запятую, минус
  if (s === '') return 0;
  var hasDot = s.indexOf('.') >= 0, hasComma = s.indexOf(',') >= 0;
  if (hasDot && hasComma) {
    // последний по позиции разделитель — десятичный
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    var parts = s.split(',');
    // одна запятая с 1–2 цифрами после неё — десятичная; иначе разделитель тысяч
    if (parts.length === 2 && parts[1].length <= 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function fmt_(s) { return (s === 0 || s) ? String(s) : '—'; }
// Безопасно читает значение ячейки по адресу (например 'C38').
function cellVal_(sheet, a1) {
  try { return String(sheet.getRange(a1).getDisplayValue()).trim(); }
  catch (e) { return ''; }
}
function money_(n) {
  if (!n) return '—';
  return Number(n).toLocaleString('ru-RU');
}
 
function styleKp_(sh, n) {
  sh.setColumnWidth(1, 340);
  sh.setColumnWidth(2, 220);
  var all = sh.getRange(1, 1, n, 2);
  all.setFontFamily('Arial').setVerticalAlignment('middle');
  // Все значения (колонка B) — по центру
  sh.getRange(1, 2, n, 1).setHorizontalAlignment('center');
  var data = sh.getRange(1, 1, n, 2).getValues();
 
  // Ищем строки по содержимому (устойчиво к смещению из-за строки логотипа)
  for (var r = 1; r <= n; r++) {
    var a = String(data[r - 1][0]).trim();
    var b = String(data[r - 1][1]).trim();
    if (/^КОМЕРЦІЙНА ПРОПОЗИЦІЯ/.test(a)) {
      sh.getRange(r, 1, 1, 2).merge().setFontSize(16).setFontWeight('bold')
        .setHorizontalAlignment('center').setBackground(CFG.BRAND_COLOR).setFontColor('#ffffff');
      // r+1 — клиент, r+2 — название компании, r+3 — контакты
      sh.getRange(r + 1, 1, 1, 2).merge().setFontSize(13).setFontWeight('bold')
        .setHorizontalAlignment('center').setFontColor(CFG.BRAND_COLOR);
      sh.getRange(r + 2, 1, 1, 2).merge().setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center');
      sh.getRange(r + 3, 1, 1, 2).merge().setFontSize(9).setFontColor('#666').setHorizontalAlignment('center');
    } else if (a && !b && /^(Параметри|Комплект|Орієнтовна)/.test(a)) {
      sh.getRange(r, 1, 1, 2).merge().setFontWeight('bold').setBackground('#e6f0ee').setFontSize(11)
        .setHorizontalAlignment('center');
    } else if (/^РАЗОМ, \$/.test(a)) {
      sh.getRange(r, 1, 1, 2).setFontWeight('bold').setFontSize(12).setBackground('#fff3cd');
    } else if (/^• Дана комерційна пропозиція є попередньою/.test(a)) {
      sh.getRange(r, 1).setFontWeight('bold').setFontColor(CFG.BRAND_COLOR);
    } else if (/^Примітка:/.test(a)) {
      sh.getRange(r, 1).setFontWeight('bold').setFontSize(12).setFontColor(CFG.BRAND_COLOR);
    }
  }

  // Никаких линий сетки/границ: явно очищаем границы (в PDF gridlines уже выключены).
  sh.getRange(1, 1, n, 2).setBorder(false, false, false, false, false, false);
}
 
// Экспорт конкретного листа в PDF-blob.
function exportSheetPdf_(ss, sheet) {
  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?'
    + 'format=pdf&gid=' + sheet.getSheetId()
    + '&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false'
    + '&pagenumbers=false&size=A4&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5'
    + '&horizontal_alignment=CENTER';
  var token = ScriptApp.getOAuthToken();
  var opts = { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  var resp, code;
  // До 4 попыток: иногда Google отвечает 500, пока лист не «прогрузился».
  for (var attempt = 0; attempt < 4; attempt++) {
    resp = UrlFetchApp.fetch(url, opts);
    code = resp.getResponseCode();
    if (code === 200) return resp.getBlob();
    Utilities.sleep(1500);
  }
  throw new Error('Не вдалося сформувати PDF (код ' + code + '). Спробуйте натиснути кнопку ще раз.');
}
 
function getFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
 
// ====================== ЛОГОТИП (встроен как PNG, base64) ======================
var LOGO_B64 = "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";
