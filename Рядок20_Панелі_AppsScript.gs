// Разова функція: додає рядок 20 «Панелі (потужність і кількість)»
// у розділ «Підбір обладнання» на аркуші «Калькулятор».
// Встановлення: Розширення → Apps Script → вставити функцію нижче →
// вибрати addPanelInfoRow20 у списку функцій → кнопка Run (▶) один раз.
// Після запуску функцію з редактора можна видалити.

function addPanelInfoRow20() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Калькулятор');

  // копіюємо формат з сусідніх рядків (без потреби вручну підбирати шрифт/колір)
  sh.getRange('B19').copyTo(sh.getRange('B20'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange('C12').copyTo(sh.getRange('C20'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

  sh.getRange('B20').setValue('Панелі (потужність і кількість)');
  sh.getRange('C20').setFormula('="620 Вт/шт × "&C42&" шт = "&TEXT(C42*0.62,"0.0")&" кВт"');
}
