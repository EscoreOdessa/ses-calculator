// calculator.js — логіка розрахунку потужності та ціни СЕС.
// Портовано з формул листа "Калькулятор" живої Google-таблиці.
// Чисті функції: (вхідні дані менеджера, довідкові дані) -> результат.
// Працює і в браузері (window.SesCalc), і в Node (module.exports) для тестів.

(function (root) {

  /**
   * @param {Object} input
   * @param {number} input.monthlyKwh        Місячне споживання, кВт·год (C4)
   * @param {"мережева"|"гібридна"} input.stationType  Тип станції (C5)
   * @param {"дах"|"земля"} input.location   Розташування (C6)
   * @param {boolean} input.vat              Форма оплати: true = з ПДВ, false = без ПДВ (C7)
   * @param {number} input.autonomyHours     Години автономії, тільки для гібридної (C8)
   * @param {string} input.roofType          Назва типу даху/кріплення з data.roofTypes (C43)
   * @param {number} [input.exchangeRate]    Курс, грн/$ (C24) — якщо не задано, тільки $ рахуються
   * @param {Object} data                    DEFAULT_DATA (або відредагована копія з localStorage)
   * @returns {Object} результат розрахунку — див. поля нижче
   */
  function calculate(input, data) {
    const c = data.constants;
    const result = { input, warnings: [] };

    // --- 1. Розрахунок потужності (C11-C15) ---
    const dailyKwh = input.monthlyKwh / 30;                 // C11
    const dayKwh = dailyKwh * c.dayShare;                    // C12
    const nightKwh = dailyKwh * c.nightShare;                // C13
    const targetKw = dayKwh / c.dayHours;                    // C15

    result.dailyKwh = dailyKwh;
    result.dayKwh = dayKwh;
    result.nightKwh = nightKwh;
    result.targetKw = targetKw;

    // --- 2. Підбір інвертора (C18) ---
    // IF(мережева, IFERROR(MIN(FILTER(mesh>=target)), MAX(mesh)), аналогічно hybrid)
    const isHybrid = input.stationType === "гібридна";
    const list = isHybrid ? data.invertersHybrid : data.invertersMesh;
    const candidates = list.filter((kw) => kw >= targetKw);
    const inverterKw = candidates.length > 0 ? Math.min(...candidates) : Math.max(...list);
    result.inverterKw = inverterKw;

    // --- 3. Ціна станції за ключем вид|розташування|оплата|потужність (C22-C25) ---
    const stationPowerKw = inverterKw; // C22 = C18
    result.stationPowerKw = stationPowerKw;

    const priceRow = data.prices.find(
      (p) =>
        p.type === input.stationType &&
        p.location === input.location &&
        p.vat === !!input.vat &&
        p.power === stationPowerKw
    );

    let pricePerKw = null;
    let stationPrice = null;
    if (priceRow) {
      pricePerKw = priceRow.price;
      stationPrice = stationPowerKw * pricePerKw; // C25 = C22*C23 (ціни в Дані вже фінальні, без додаткової націнки)
    } else {
      result.warnings.push("Немає ціни для цієї комбінації вид/розташування/оплата/потужність — уточнити у менеджера.");
    }
    result.pricePerKw = pricePerKw;
    result.stationPrice = stationPrice;

    // --- 4. Панелі (C42) ---
    const panelCount = Math.ceil(stationPowerKw / c.panelPowerKw);
    result.panelCount = panelCount;
    result.panelTotalKw = panelCount * c.panelPowerKw;

    // --- 5. Кріплення (C43-C45) ---
    const roof = data.roofTypes.find((r) => r.name === input.roofType);
    let mountPricePerPanel = null;
    let mountTotal = null;
    if (roof) {
      mountPricePerPanel = roof.price * c.akbMarkup; // C44, з націнкою (не округлюється при рахунку)
      mountTotal = panelCount * mountPricePerPanel;   // C45
    } else {
      result.warnings.push("Не вибрано тип даху/кріплення — уточнити у менеджера.");
    }
    result.mountPricePerPanel = mountPricePerPanel;
    result.mountTotal = mountTotal;

    // --- 6. Автономія та АКБ (C29-C39), тільки для гібридної ---
    let akb = null;
    if (isHybrid) {
      const requiredKwh = input.autonomyHours * dailyKwh / 24; // C29
      const bank = requiredKwh > c.hvThresholdKwh ? "HV" : "LV"; // C30
      const catalog = bank === "HV" ? data.batteriesHV : data.batteriesLV;

      // Підбір моделі: мінімальна зайва ємність (без запасу), тай-брейк — менше модулів.
      let chosen = null;
      if (requiredKwh > 0 && catalog.length > 0) {
        let best = null;
        for (const model of catalog) {
          const modulesRaw = Math.ceil(requiredKwh / model.capacity);
          const waste = modulesRaw * model.capacity - requiredKwh;
          if (
            best === null ||
            waste < best.waste - 1e-9 ||
            (Math.abs(waste - best.waste) < 1e-9 && modulesRaw < best.modulesRaw)
          ) {
            best = { model, modulesRaw, waste };
          }
        }
        chosen = best.model;
      } else if (catalog.length > 0) {
        // Фолбек: немає вимоги до ємності — беремо модель з максимальною ємністю.
        chosen = catalog.reduce((a, b) => (b.capacity > a.capacity ? b : a));
      }

      if (chosen) {
        // Фінальна кількість модулів — із запасом (C33).
        const moduleCount = Math.ceil(requiredKwh / c.akbModuleMargin / chosen.capacity);
        const totalCapacityKwh = moduleCount * chosen.capacity;

        const priceVat = moduleCount * chosen.priceVat;
        const priceNoVat = moduleCount * chosen.priceNoVat;
        let bmsPriceVat = 0, bmsPriceNoVat = 0, rackCount = 0, rackPriceVat = 0, rackPriceNoVat = 0;

        if (bank === "HV") {
          rackCount = Math.ceil(moduleCount / chosen.batteriesPerRack); // C37
          bmsPriceVat = rackCount * chosen.bmsPriceVat;
          bmsPriceNoVat = rackCount * chosen.bmsPriceNoVat;
          rackPriceVat = rackCount * chosen.rackPriceVat;
          rackPriceNoVat = rackCount * chosen.rackPriceNoVat;
        }

        const kitPriceVat = (priceVat + bmsPriceVat + rackPriceVat) * c.akbMarkup;     // C38
        const kitPriceNoVat = (priceNoVat + bmsPriceNoVat + rackPriceNoVat) * c.akbMarkup; // C39

        akb = {
          requiredKwh,
          bank,
          model: chosen.model,
          moduleCapacityKwh: chosen.capacity,
          moduleCount,
          totalCapacityKwh,
          bms: bank === "HV" ? chosen.bms : null,
          rack: bank === "HV" ? chosen.rack : null,
          rackCount: bank === "HV" ? rackCount : null,
          kitPriceVat,
          kitPriceNoVat,
        };
      } else {
        result.warnings.push("Не вдалося підібрати модель АКБ — перевірте каталог Акумулятори LV/HV.");
      }
    }
    result.akb = akb;

    // --- 7. Разом по СЕС (C48-C49) ---
    let total = null;
    if (stationPrice !== null && mountTotal !== null) {
      let akbPart = 0;
      if (isHybrid) {
        if (!akb) {
          result.warnings.push("Немає АКБ для розрахунку підсумку — уточнити у менеджера.");
        } else {
          akbPart = input.vat ? akb.kitPriceVat : akb.kitPriceNoVat;
        }
      }
      total = stationPrice + akbPart + mountTotal;
    }
    result.totalUsd = total;
    result.totalUah = total !== null && input.exchangeRate ? total * input.exchangeRate : null;

    return result;
  }

  const api = { calculate };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.SesCalc = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
