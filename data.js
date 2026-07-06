// data.js — довідкові дані калькулятора СЕС.
// Джерело: жива Google-таблиця "Version_Калькулятор_СЭС"
// (1fVpkQ1hISLlMFAyUjumawSkas6a85gnFciHO2rpJr7U), звірено вручну 2026-07-03.
// Ці дані — СТАРТОВІ значення. Реальні (можливо відредаговані менеджером)
// значення живуть у localStorage і завантажуються поверх цих через storage.js.

const DEFAULT_DATA = {

  // Дані!A2:A18 — інвертори DEYE мережеві, кВт
  invertersMesh: [5, 10, 15, 20, 30, 50, 100],

  // Дані!C2:C18 — інвертори DEYE гібридні, кВт
  invertersHybrid: [5, 10, 15, 20, 25, 30, 50],

  // Дані!H2:M25 — ціна за кВт станції залежно від виду/розташування/оплати/потужності
  // vat: true = "ПДВ,", false = без ПДВ (порожньо)
  prices: [
    { type: "мережева", location: "дах",   vat: false, power: 50,  price: 354 },
    { type: "мережева", location: "дах",   vat: true,  power: 50,  price: 415 },
    { type: "гібридна",  location: "дах",   vat: false, power: 50,  price: 409 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 50,  price: 476 },
    { type: "мережева", location: "земля", vat: false, power: 50,  price: 405 },
    { type: "мережева", location: "земля", vat: true,  power: 50,  price: 475 },
    { type: "мережева", location: "дах",   vat: false, power: 100, price: 314 },
    { type: "мережева", location: "дах",   vat: true,  power: 100, price: 369 },
    { type: "мережева", location: "земля", vat: false, power: 100, price: 336 },
    { type: "мережева", location: "земля", vat: true,  power: 100, price: 396 },
    { type: "гібридна",  location: "дах",   vat: false, power: 100, price: 375 },
    { type: "гібридна",  location: "дах",   vat: true,  power: 100, price: 397 },
    { type: "мережева", location: "дах",   vat: false, power: 5,   price: 627 },
    { type: "гібридна",  location: "дах",   vat: false, power: 5,   price: 643 },
    { type: "мережева", location: "дах",   vat: false, power: 10,  price: 477 },
    { type: "гібридна",  location: "дах",   vat: false, power: 10,  price: 520 },
    { type: "мережева", location: "дах",   vat: false, power: 15,  price: 407 },
    { type: "гібридна",  location: "дах",   vat: false, power: 15,  price: 455 },
    { type: "мережева", location: "дах",   vat: false, power: 20,  price: 374 },
    { type: "гібридна",  location: "дах",   vat: false, power: 20,  price: 388 },
    { type: "гібридна",  location: "земля", vat: false, power: 25,  price: 404 },
    { type: "мережева", location: "дах",   vat: false, power: 30,  price: 332 },
    { type: "мережева", location: "земля", vat: false, power: 30,  price: 368 },
    { type: "гібридна",  location: "дах",   vat: false, power: 30,  price: 390 },
  ],

  // Дані!O2:P7 — тип даху / кріплення -> ціна за панель, $ (без націнки)
  roofTypes: [
    { name: "Профнастил",                      price: 12 },
    { name: "Пласкій дах",                      price: 38 },
    { name: "Керамічна черепиця",               price: 42 },
    { name: "Металопрофіль (Скатний дах)",      price: 40 },
    { name: "Кріплення на бітумну черепицю",    price: 19 },
    { name: "Кріплення наземле",                price: 65 },
  ],

  // Акумулятори LV, рядки 9-13
  batteriesLV: [
    { model: "SE-F16-C",     desc: "DEYE SE-F16-C LiFePO4 LV 51.2V 314Ah",     capacity: 16.0, voltage: 51.2, priceVat: 2080, priceNoVat: 1800 },
    { model: "RW-F16",       desc: "DEYE RW-F16 LiFePO4 LV 51.2V 314Ah",       capacity: 14.4, voltage: 51.2, priceVat: 2275, priceNoVat: 1935 },
    { model: "SE-F12-C",     desc: "DEYE SE-F12-C LiFePO4 LV 51.2V 230Ah",     capacity: 11.8, voltage: 51.2, priceVat: 1650, priceNoVat: 1470 },
    { model: "SE-F5 Pro-C",  desc: "DEYE SE-F5 Pro LiFePO4 LV 51.2V 100Ah",    capacity: 5.12, voltage: 51.2, priceVat: 850,  priceNoVat: 720 },
    { model: "SE-G5.1 Pro-B", desc: "DEYE SE-G5.1 Pro-B LiFePO4 LV 51.2V 100Ah", capacity: 5.12, voltage: 51.2, priceVat: 880, priceNoVat: 750 },
  ],

  // Акумулятори HV, рядки 9-11 (окремий BMS + стійка)
  batteriesHV: [
    {
      model: "BOS-B-Pack16-A3", desc: "DEYE BOS-B PRO LiFePO4 HV 51.2V 314Ah", capacity: 16.08,
      priceVat: 2040, priceNoVat: 1750,
      bms: "BOS-B-PDU-2-A", bmsPriceVat: 1580, bmsPriceNoVat: 1450,
      rack: "RACK/BOS-B-PRO", batteriesPerRack: 15, rackPriceVat: 770, rackPriceNoVat: 680,
    },
    {
      model: "BOS-G", desc: "DEYE BOS-G LiFePO4 HV 51.2V 100Ah (no BMS)", capacity: 5.12,
      priceVat: 870, priceNoVat: 755,
      bms: "BOS-G-PDU-2", bmsPriceVat: 870, bmsPriceNoVat: 755,
      rack: "3U-LRACK", batteriesPerRack: 8, rackPriceVat: 330, rackPriceNoVat: 290,
    },
    {
      model: "BOS-A", desc: "DEYE BOS-A LiFePO4 HV 38.4V 200Ah", capacity: 7.68,
      priceVat: 1290, priceNoVat: 1110,
      bms: "BOS-A-PDU-2 1000V/160A", bmsPriceVat: 1120, bmsPriceNoVat: 960,
      rack: "BOS-A-Rack11", batteriesPerRack: 11, rackPriceVat: 370, rackPriceNoVat: 330,
    },
  ],

  // Константи розрахунку
  constants: {
    dayShare: 0.8,          // денне споживання, частка від добового
    nightShare: 0.2,
    dayHours: 12,            // 8:00-20:00
    inverterMaxOverload: 1.1, // інвертор не більше ніж +10% від цільової потужності (довідково)
    panelPowerKw: 0.62,      // потужність однієї панелі, кВт (620 Вт)
    akbMarkup: 1.15,         // націнка на АКБ і кріплення
    akbModuleMargin: 0.7,    // запас під час підбору кількості модулів АКБ (C33 = CEILING(req/0.7/cap))
    hvThresholdKwh: 50,      // поріг ємності АКБ, вище якого обирається HV замість LV
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_DATA };
}
