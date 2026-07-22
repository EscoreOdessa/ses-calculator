// data.js — довідкові дані калькулятора СЕС.
// Джерело: жива Google-таблиця "Version_Калькулятор_СЭС"
// (1fVpkQ1hISLlMFAyUjumawSkas6a85gnFciHO2rpJr7U), звірено вручну 2026-07-03.
// 2026-07-21: додано inverterPricesMesh/Hybrid (Дані!A1:F8) і
// prices[].materialsLabor (Дані!I1:O35, стовпець O) — звірено з живою
// таблицею через CSV-експорт того ж дня.
// Ці дані — СТАРТОВІ значення. Реальні (можливо відредаговані менеджером)
// значення живуть у localStorage і завантажуються поверх цих через storage.js.

const DEFAULT_DATA = {

  // Дані!A2:A18 — інвертори SolaX Power мережеві, кВт
  invertersMesh: [5, 10, 15, 20, 30, 50, 100],

  // Дані!C2:C18 — інвертори DEYE гібридні, кВт
  // 2026-07-22 (Anna): 25 кВт прибрано зі списку — для нього немає ціни НІДЕ
  // (ні в бандл-таблиці prices[], ні в inverterPricesHybrid), тому авто-підбір
  // (напр. 10000 кВт·год/міс → цільова ≈22.2 кВт) раніше вибирав 25 кВт і
  // видавав "уточнити у менеджера" замість ціни. Тепер такі випадки
  // округлюються до наступного реально прайсованого розміру — 30 кВт.
  invertersHybrid: [5, 10, 15, 20, 30, 50],

  // 2026-07-21: реальні ціни на КОНКРЕТНІ інвертори (Дані!A1:F8) — Anna
  // додала для режиму «Ручний ввід обладнання»: коли менеджер задає
  // потужність інвертора вручну, ціна станції рахується з ЦИХ цін
  // (інвертор + materialsLabor нижче), а не з орієнтовної бандл-таблиці
  // prices[].price. kw має збігатись із invertersMesh/invertersHybrid вище.
  // priceVat/priceNoVat: null = ціна ще не внесена в Дані — тоді розрахунок
  // тихо відкочується на стару бандл-ціну (рішення Anna 2026-07-21).
  inverterPricesMesh: [
    { kw: 5,   priceVat: 722,  priceNoVat: 603 },
    { kw: 10,  priceVat: 1074, priceNoVat: 896 },
    { kw: 15,  priceVat: 1208, priceNoVat: 1008 },
    { kw: 20,  priceVat: 1343, priceNoVat: 1110 },
    { kw: 30,  priceVat: 2183, priceNoVat: 1357 },
    { kw: 50,  priceVat: 2224, priceNoVat: 1853 },
    { kw: 100, priceVat: 3662, priceNoVat: 3052 }, // 2026-07-21: Anna внесла ціну в Дані
  ],

  // Дані!D1:F8. ПРИМІТКА: у Дані немає рядка для 25 кВт (є в invertersHybrid
  // вище, але без ціни) — для нього теж спрацює фолбек на бандл-ціну.
  // kw:100 (додано 2026-07-21) — ціна є, АЛЕ 100 немає в invertersHybrid
  // вище (список моделей гібридних інверторів), тому inverterKw=100 для
  // гібридної станції ніколи не підбереться автоматично — ця ціна поки що
  // "мертва", доки Anna не підтвердить, що треба додати 100 і в сам список.
  inverterPricesHybrid: [
    { kw: 5,  priceVat: 981,  priceNoVat: 829 },
    { kw: 10, priceVat: 1882, priceNoVat: 1702 },
    { kw: 15, priceVat: 2352, priceNoVat: 1949 },
    { kw: 20, priceVat: 3091, priceNoVat: 2576 },
    { kw: 30, priceVat: 3528, priceNoVat: 2968 },
    { kw: 50, priceVat: 5123, priceNoVat: 4360 },
    { kw: 100, priceVat: 10246, priceNoVat: 8720 },
  ],

  // Ціна за кВт станції залежно від виду/розташування/оплати/потужності.
  // vat: true = ціна з ПДВ, false = без ПДВ (готівка).
  // ВАЖЛИВО (2026-07-17): ціни очищені Anna вручну від панелей, АКБ і
  // кріплень — тут лишається тільки інвертор + матеріали + роботи. Панелі
  // рахуються окремо (panelPrice нижче), АКБ і кріплення — теж окремо
  // (batteriesLV/HV, roofTypes). Джерело: ses-dani-2026-07-17.json.
  //
  // materialsLabor (2026-07-21, з Дані!O, стовпець "Ціна без обладнання
  // (вкл витратні матеріали та роботи)"): попри назву стовпця в Google
  // Sheets, це НЕ ціна за кВт — це ЗАГАЛЬНА сума матеріалів+робіт для
  // станції такого розміру (перевірено: інвертор(A:F)+ця сума+панелі+
  // кріплення ≈ старій бандл-ціні price×power — подвійного обліку нема).
  // Використовується тільки в режимі «Ручний ввід обладнання»
  // (calculator.js: stationPrice = inverterUnitPrice + materialsLabor).
  // null = цієї комбінації немає в Дані!O — розрахунок тихо відкочується
  // на бандл-ціну price×power (рішення Anna 2026-07-21).
  prices: [
    { type: "мережева", location: "дах",   vat: false, power: 100, price: 154.57, materialsLabor: 11288 },
    { type: "мережева", location: "дах",   vat: true,  power: 100, price: 177.85, materialsLabor: 11428 },
    { type: "мережева", location: "земля", vat: false, power: 100, price: 180.02, materialsLabor: 13764 },
    { type: "мережева", location: "земля", vat: true,  power: 100, price: 227.47, materialsLabor: 15158 },
    { type: "гібридна",  location: "дах",   vat: false, power: 100, price: 214.56, materialsLabor: 11428 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 100, price: 226.94, materialsLabor: 11656 },
    { type: "мережева", location: "дах",   vat: false, power: 50,  price: 201.24, materialsLabor: 7783 },
    { type: "мережева", location: "дах",   vat: true,  power: 50,  price: 232.07, materialsLabor: 7833 },
    { type: "гібридна",  location: "дах",   vat: false, power: 50,  price: 254.35, materialsLabor: 8083 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 50,  price: 286.51, materialsLabor: 8043 },
    { type: "мережева", location: "земля", vat: false, power: 50,  price: 249.94, materialsLabor: 8700 },
    { type: "мережева", location: "земля", vat: true,  power: 50,  price: 288.21, materialsLabor: 11562 },
    { type: "мережева", location: "дах",   vat: false, power: 5,   price: 489.82, materialsLabor: 1347 },
    { type: "мережева", location: "дах",   vat: true,  power: 5,   price: 602.18, materialsLabor: 1354 },
    { type: "гібридна",  location: "дах",   vat: false, power: 5,   price: 485.04, materialsLabor: 1408 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 5,   price: 560.78, materialsLabor: 1408 },
    { type: "мережева", location: "дах",   vat: false, power: 10,  price: 337.28, materialsLabor: 1903 },
    { type: "мережева", location: "дах",   vat: true,  power: 10,  price: 407.39, materialsLabor: 1903 },
    { type: "гібридна",  location: "дах",   vat: false, power: 10,  price: 374.76, materialsLabor: 1822 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 10,  price: 423.56, materialsLabor: 1825 },
    { type: "мережева", location: "дах",   vat: false, power: 15,  price: 256.42, materialsLabor: 2257 },
    { type: "мережева", location: "дах",   vat: true,  power: 15,  price: 307.61, materialsLabor: 2257 },
    { type: "гібридна",  location: "дах",   vat: false, power: 15,  price: 308.13, materialsLabor: 2317 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 15,  price: 339.98, materialsLabor: 2317 },
    { type: "мережева", location: "дах",   vat: false, power: 20,  price: 222.55, materialsLabor: 2702 },
    { type: "мережева", location: "дах",   vat: true,  power: 20,  price: 265.86, materialsLabor: 2703 },
    { type: "гібридна",  location: "дах",   vat: false, power: 20,  price: 269.65, materialsLabor: 2481 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 20,  price: 315.43, materialsLabor: 2481 },
    { type: "мережева", location: "дах",   vat: false, power: 30,  price: 183.9,  materialsLabor: 3486 },
    { type: "мережева", location: "дах",   vat: true,  power: 30,  price: 232.31, materialsLabor: 3486 }, // виправлено 2026-07-21: K31 у Дані була пуста (мала бути "ПДВ,")
    { type: "гібридна",  location: "дах",   vat: false, power: 30,  price: 243.84, materialsLabor: 3912 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 30,  price: 277.98, materialsLabor: 3912 },
    { type: "мережева", location: "земля", vat: false, power: 30,  price: 222.18, materialsLabor: 4331 },
    { type: "мережева", location: "земля", vat: true,  power: 30,  price: 263.1,  materialsLabor: 4331 },
  ],

  // Дані!O2:P7 — тип даху / кріплення -> ціна за панель, $ (без націнки)
  // adjustableTilt: true = регульовані стійки з вибором кута (15/20/30°) —
  // плаский дах і наземне кріплення; false = панелі впритул до існуючого
  // схилу даху, кут кріплень = кут ската (невідомий без виїзду на об'єкт,
  // тому «Розкладка панелей»/«Виробництво» не показують конкретне число
  // градусів для таких типів). Категорізацію підтвердила Anna 2026-07-06.
  roofTypes: [
    { name: "Профнастил",                      price: 12, adjustableTilt: true },
    { name: "Пласкій дах",                      price: 38, adjustableTilt: true },
    { name: "Керамічна черепиця",               price: 42, adjustableTilt: false },
    { name: "Металопрофіль (Скатний дах)",      price: 40, adjustableTilt: false },
    { name: "Кріплення на бітумну черепицю",    price: 19, adjustableTilt: false },
    { name: "Кріплення наземле",                price: 65, adjustableTilt: true },
  ],

  // Акумулятори LV. RW-F16 прибрано Anna 2026-07-18 (модель більше не пропонується).
  // Джерело: ses-dani-2026-07-18.json.
  batteriesLV: [
    { model: "SE-F16-C",     desc: "DEYE SE-F16-C LiFePO4 LV 51.2V 314Ah",     capacity: 16.0, voltage: 51.2, priceVat: 2576, priceNoVat: 2184 },
    { model: "SE-F12-C",     desc: "DEYE SE-F12-C LiFePO4 LV 51.2V 230Ah",     capacity: 11.8, voltage: 51.2, priceVat: 1908, priceNoVat: 1590 },
    { model: "SE-F5 Pro-C",  desc: "DEYE SE-F5 Pro LiFePO4 LV 51.2V 100Ah",    capacity: 5.12, voltage: 51.2, priceVat: 1125, priceNoVat: 939 },
    { model: "SE-G5.1 Pro-B", desc: "DEYE SE-G5.1 Pro-B LiFePO4 LV 51.2V 100Ah", capacity: 5.12, voltage: 51.2, priceVat: 1126, priceNoVat: 939 },
  ],

  // Акумулятори HV (окремий BMS + стійка). Джерело: ses-dani-2026-07-18.json.
  batteriesHV: [
    {
      model: "BOS-B-Pack16-A3", desc: "DEYE BOS-B PRO LiFePO4 HV 51.2V 314Ah", capacity: 16.08,
      priceVat: 2352, priceNoVat: 2022,
      bms: "BOS-B-PDU-2-A", bmsPriceVat: 1209, bmsPriceNoVat: 1019,
      rack: "RACK/BOS-B-PRO", batteriesPerRack: 15, rackPriceVat: 862, rackPriceNoVat: 725,
    },
    {
      model: "BOS-G", desc: "DEYE BOS-G LiFePO4 HV 51.2V 100Ah (no BMS)", capacity: 5.12,
      priceVat: 1084, priceNoVat: 902,
      bms: "BOS-G-PDU-2", bmsPriceVat: 1084, bmsPriceNoVat: 902,
      rack: "3U-LRACK", batteriesPerRack: 8, rackPriceVat: 481, rackPriceNoVat: 421,
    },
    {
      model: "BOS-A", desc: "DEYE BOS-A LiFePO4 HV 38.4V 200Ah", capacity: 7.68,
      priceVat: 1505, priceNoVat: 1385,
      bms: "BOS-A-PDU-2 1000V/160A", bmsPriceVat: 1264, bmsPriceNoVat: 1204,
      rack: "BOS-A-Rack11", batteriesPerRack: 11, rackPriceVat: 722, rackPriceNoVat: 602,
    },
  ],

  // Ціна панелі, $ за Вт (окремо від ціни станції — див. panelPowerKw нижче).
  // vat: з ПДВ, noVat: без ПДВ (готівка). Редагується на вкладці «Дані».
  panelPrice: { vat: 0.18, noVat: 0.15 },

  // Константи розрахунку
  constants: {
    dayShare: 0.8,          // денне споживання, частка від добового
    nightShare: 0.2,
    dayHours: 12,            // 8:00-20:00
    inverterMaxOverload: 1.1, // інвертор не більше ніж +10% від цільової потужності (довідково)
    panelPowerKw: 0.615,     // потужність однієї панелі, кВт (615 Вт)
    akbMarkup: 1.15,         // націнка на АКБ і кріплення
    akbModuleMargin: 0.7,    // запас під час підбору кількості модулів АКБ (C33 = CEILING(req/0.7/cap))
    hvThresholdKwh: 50,      // СТАРЕ, БІЛЬШЕ НЕ ВИКОРИСТОВУЄТЬСЯ для вибору LV/HV (лишено про запас на випадок відкоту).
    // 2026-07-21 (Anna): LV/HV — апаратне обмеження САМОГО інвертора, не ємності
    // АКБ. Інвертори 5/10/15 кВт — LV; 20 кВт і вище (в т.ч. паралель, напр.
    // 2×50=100) — HV. Джерело: реальний кейс — 50кВт інвертор помилково
    // отримував LV-акумулятор SE-F5 Pro-C через старий поріг за ємністю.
    hvInverterKwThreshold: 20,
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_DATA };
}
