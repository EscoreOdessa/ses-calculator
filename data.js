// data.js — довідкові дані калькулятора СЕС.
// Джерело прайсу: лист «Дані» (Google Sheet 1GT9wzmzrWiMwqQHIlsUf9L3fh9cm1n1RvejEtCq1NVs),
// звірено вручну 2026-08-07.
// Ці дані — СТАРТОВІ значення. Реальні (можливо відредаговані менеджером)
// значення живуть у localStorage і завантажуються поверх цих через storage.js.
//
// 2026-08-07 — НОВИЙ ПРИНЦИП ЦІНИ: вартість станції = сума компонентів
//   інвертор + панелі + АКБ + кріплення + матеріали + роботи + доставка.
//   Стовпця «ціна за кВт» більше немає (стару таблицю prices[] з price=$/кВт
//   прибрано). Матеріали/роботи/доставка — окремі суми $ під кожен розмір
//   станції (таблиця station[] нижче).

const DEFAULT_DATA = {

  // Інвертори SolaX Power мережеві, кВт — список моделей для підбору.
  invertersMesh: [5, 10, 15, 20, 30, 50, 100],

  // Інвертори DEYE гібридні, кВт — список моделей для підбору.
  // 2026-08-07: новий модельний ряд 6/8/10/12/15/20/30/50/100.
  invertersHybrid: [6, 8, 10, 12, 15, 20, 30, 50, 100],

  // Ціна за КОНКРЕТНУ модель інвертора, $ (з ПДВ / без ПДВ).
  // kw має збігатись зі списком invertersMesh/invertersHybrid вище.
  inverterPricesMesh: [   // SolaX Power (мережеві)
    { kw: 5,   priceVat: 722,  priceNoVat: 602 },
    { kw: 10,  priceVat: 1074, priceNoVat: 896 },
    { kw: 15,  priceVat: 1208, priceNoVat: 1008 },
    { kw: 20,  priceVat: 1331, priceNoVat: 1110 },
    { kw: 30,  priceVat: 1658, priceNoVat: 1357 },
    { kw: 50,  priceVat: 2223, priceNoVat: 1853 },
    { kw: 100, priceVat: 3662, priceNoVat: 3052 },
  ],
  inverterPricesHybrid: [   // DEYE (гібридні)
    { kw: 6,   priceVat: 981,   priceNoVat: 829 },
    { kw: 8,   priceVat: 1364,  priceNoVat: 1264 },
    { kw: 10,  priceVat: 1882,  priceNoVat: 1702 },
    { kw: 12,  priceVat: 1949,  priceNoVat: 1714 },
    { kw: 15,  priceVat: 2352,  priceNoVat: 1950 },
    { kw: 20,  priceVat: 3091,  priceNoVat: 2576 },
    { kw: 30,  priceVat: 3528,  priceNoVat: 3024 },
    { kw: 50,  priceVat: 5508,  priceNoVat: 4629 },
    { kw: 100, priceVat: 11016, priceNoVat: 9258 },
  ],

  // Матеріали / роботи / доставка — окремі суми $ під кожен розмір станції.
  // Ключ підбору: вид|розташування|оплата(vat)|потужність(=потужність інвертора).
  // vat: true = з ПДВ, false = без ПДВ (готівка). Замінює стару prices[] з price=$/кВт.
  // Якщо точної потужності немає — калькулятор бере найближчий розмір у межах
  // того самого вид+розташування+оплата (calculator.js).
  station: [
    { type: "мережева", location: "дах",   vat: false, power: 5,   materials: 825,  labor: 891,   delivery: 100 },
    { type: "мережева", location: "дах",   vat: true,  power: 5,   materials: 1050, labor: 891,   delivery: 100 },
    { type: "гібридна", location: "дах",   vat: false, power: 6,   materials: 456,  labor: 1003,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: true,  power: 6,   materials: 456,  labor: 1003,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: false, power: 8,   materials: 487,  labor: 1265,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: true,  power: 8,   materials: 487,  labor: 1265,  delivery: 100 },
    { type: "мережева", location: "дах",   vat: false, power: 10,  materials: 927,  labor: 1345,  delivery: 100 },
    { type: "мережева", location: "дах",   vat: true,  power: 10,  materials: 1140, labor: 1345,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: false, power: 10,  materials: 558,  labor: 1345,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: true,  power: 10,  materials: 558,  labor: 1345,  delivery: 100 },
    { type: "гібридна", location: "дах",   vat: false, power: 12,  materials: 589,  labor: 1554,  delivery: 120 },
    { type: "гібридна", location: "дах",   vat: true,  power: 12,  materials: 589,  labor: 1554,  delivery: 120 },
    { type: "мережева", location: "дах",   vat: false, power: 15,  materials: 1065, labor: 1561,  delivery: 120 },
    { type: "мережева", location: "дах",   vat: true,  power: 15,  materials: 1278, labor: 1561,  delivery: 120 },
    { type: "гібридна", location: "дах",   vat: false, power: 15,  materials: 696,  labor: 1621,  delivery: 120 },
    { type: "гібридна", location: "дах",   vat: true,  power: 15,  materials: 696,  labor: 1621,  delivery: 120 },
    { type: "мережева", location: "дах",   vat: false, power: 20,  materials: 1170, labor: 1900,  delivery: 120 },
    { type: "мережева", location: "дах",   vat: true,  power: 20,  materials: 1380, labor: 1900,  delivery: 120 },
    { type: "гібридна", location: "дах",   vat: false, power: 20,  materials: 971,  labor: 1678,  delivery: 150 },
    { type: "гібридна", location: "дах",   vat: true,  power: 20,  materials: 993,  labor: 1678,  delivery: 150 },
    { type: "мережева", location: "дах",   vat: false, power: 30,  materials: 1488, labor: 2358,  delivery: 170 },
    { type: "мережева", location: "дах",   vat: true,  power: 30,  materials: 1706, labor: 2660,  delivery: 170 },
    { type: "гібридна", location: "дах",   vat: false, power: 30,  materials: 1104, labor: 2808,  delivery: 250 },
    { type: "гібридна", location: "дах",   vat: true,  power: 30,  materials: 948,  labor: 2808,  delivery: 250 },
    { type: "мережева", location: "земля", vat: false, power: 30,  materials: 1488, labor: 3203,  delivery: 500 },
    { type: "мережева", location: "земля", vat: true,  power: 30,  materials: 1694, labor: 3203,  delivery: 500 },
    { type: "мережева", location: "дах",   vat: false, power: 50,  materials: 3827, labor: 4315,  delivery: 500 },
    { type: "мережева", location: "дах",   vat: true,  power: 50,  materials: 3920, labor: 4365,  delivery: 500 },
    { type: "гібридна", location: "дах",   vat: false, power: 50,  materials: 3468, labor: 4615,  delivery: 500 },
    { type: "гібридна", location: "дах",   vat: true,  power: 50,  materials: 3468, labor: 4375,  delivery: 500 },
    { type: "мережева", location: "земля", vat: false, power: 50,  materials: 3887, labor: 5172,  delivery: 500 },
    { type: "мережева", location: "земля", vat: true,  power: 50,  materials: 4000, labor: 5222,  delivery: 500 },
    { type: "мережева", location: "дах",   vat: false, power: 100, materials: 4667, labor: 6980,  delivery: 700 },
    { type: "мережева", location: "дах",   vat: true,  power: 100, materials: 4780, labor: 7030,  delivery: 700 },
    { type: "гібридна", location: "дах",   vat: false, power: 100, materials: 4308, labor: 7348,  delivery: 1000 },
    { type: "гібридна", location: "дах",   vat: true,  power: 100, materials: 4008, labor: 7420,  delivery: 1000 },
    { type: "мережева", location: "земля", vat: false, power: 100, materials: 4667, labor: 9456,  delivery: 1000 },
    { type: "мережева", location: "земля", vat: true,  power: 100, materials: 4780, labor: 10850, delivery: 1000 },
  ],

  // Тип даху / кріплення -> ціна за панель, $ (фінальна, без націнки).
  // adjustableTilt: true = регульовані стійки (плаский дах, наземне); false = під схил даху.
  roofTypes: [
    { name: "Профнастил",                      price: 12, adjustableTilt: true },
    { name: "Пласкій дах",                      price: 38, adjustableTilt: true },
    { name: "Керамічна черепиця",               price: 42, adjustableTilt: false },
    { name: "Металопрофіль (Скатний дах)",      price: 40, adjustableTilt: false },
    { name: "Кріплення на бітумну черепицю",    price: 19, adjustableTilt: false },
    { name: "Кріплення наземле",                price: 65, adjustableTilt: true },
  ],

  // Акумулятори LV (для гібридних) — ціна за модуль, $. Джерело: лист «Дані» 2026-08-07.
  batteriesLV: [
    { model: "SE-F16-C",    desc: "DEYE SE-F16-C LiFePO4 LV 51.2V 314Ah",  capacity: 16.0, voltage: 51.2, priceVat: 2310, priceNoVat: 2264 },
    { model: "SE-F12-C",    desc: "DEYE SE-F12-C LiFePO4 LV 51.2V 230Ah",  capacity: 11.8, voltage: 51.2, priceVat: 1874, priceNoVat: 1837 },
    { model: "SE-F5 Pro-C", desc: "DEYE SE-F5 Pro LiFePO4 LV 51.2V 100Ah", capacity: 5.12, voltage: 51.2, priceVat: 1120, priceNoVat: 829 },
  ],

  // Акумулятори HV (для гібридних) — окремі BMS + стійка. Джерело: лист «Дані» 2026-08-07.
  // BOS-G: BMS-ціна не задана в листі -> 0.
  batteriesHV: [
    {
      model: "BOS-B-Pack16-A3", desc: "DEYE BOS-B PRO LiFePO4 HV 51.2V 314Ah", capacity: 16.08,
      priceVat: 2112, priceNoVat: 1798,
      bms: "BOS-B-PDU-2-A", bmsPriceVat: 1710, bmsPriceNoVat: 1540,
      rack: "RACK/BOS-B-PRO", batteriesPerRack: 15, rackPriceVat: 677, rackPriceNoVat: 577,
    },
    {
      model: "BOS-G", desc: "DEYE BOS-G LiFePO4 HV 51.2V 100Ah", capacity: 5.12,
      priceVat: 940, priceNoVat: 797,
      bms: "BOS-G-PDU-2", bmsPriceVat: 0, bmsPriceNoVat: 0,
      rack: "3U-HRACK", batteriesPerRack: 13, rackPriceVat: 445, rackPriceNoVat: 390,
    },
    {
      model: "BOS-A", desc: "DEYE BOS-A LiFePO4 HV 38.4V 200Ah", capacity: 7.68,
      priceVat: 1084, priceNoVat: 902,
      bms: "BOS-A-PDU-2 1000V/160A", bmsPriceVat: 1084, bmsPriceNoVat: 902,
      rack: "BOS-A-Rack11", batteriesPerRack: 11, rackPriceVat: 481, rackPriceNoVat: 421,
    },
  ],

  // Ціна панелі, $ за Вт (окремо від ціни станції; потужність панелі — panelPowerKw).
  // vat: з ПДВ, noVat: без ПДВ (готівка).
  panelPrice: { vat: 0.2016, noVat: 0.168 },

  // Константи розрахунку
  constants: {
    dayShare: 0.8,          // денне споживання, частка від добового
    nightShare: 0.2,
    dayHours: 12,            // 8:00-20:00
    inverterMaxOverload: 1.1, // довідково
    panelPowerKw: 0.615,     // потужність однієї панелі, кВт (615 Вт)
    akbMarkup: 1.0,          // 2026-08-07: націнку прибрано — ціни в листі «Дані» фінальні
    akbModuleMargin: 1.0,    // без запасу: кількість модулів рівно під потребу (CEILING(req/1.0/cap))
    hvThresholdKwh: 50,      // СТАРЕ, не використовується для вибору LV/HV.
    // LV/HV — апаратне обмеження інвертора: 5..15 кВт LV; 20 кВт і вище — HV.
    hvInverterKwThreshold: 20,
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_DATA };
}
