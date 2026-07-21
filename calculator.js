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
    const targetKw = dayKwh / c.dayHours;                    // C15 — завжди розрахункове, для довідки

    result.dailyKwh = dailyKwh;
    result.dayKwh = dayKwh;
    result.nightKwh = nightKwh;
    result.targetKw = targetKw;

    // --- 2. Підбір інвертора (C18) ---
    // Ручний ввід (клієнт вже знає бажану потужність) підміняє базу підбору,
    // далі — той самий підбір з довідкового списку (найближчий доступний ≥ бази).
    const isHybrid = input.stationType === "гібридна";
    const manualInverterUsed = !!(input.manualInverterKw && input.manualInverterKw > 0);
    const inverterBasisKw = manualInverterUsed ? input.manualInverterKw : targetKw;
    result.manualInverterUsed = manualInverterUsed;

    const list = isHybrid ? data.invertersHybrid : data.invertersMesh;
    const maxListKw = Math.max(...list);

    // 2026-07-21 (рішення Anna): DEYE гібридні йдуть максимум по maxListKw
    // (зараз 50 кВт) за один блок. Для більшої потужності — паралель N
    // однакових блоків максимального розміру, округлення ВГОРУ (2×50=100,
    // 3×50=150...). Застосовується завжди, як тільки базова потужність
    // гібридної станції перевищує maxListKw — і в авто-розрахунку за
    // споживанням, і в ручному вводі. Мережеві (SolaX) так не рахуємо —
    // там кожен розмір зі списку (включно з 100кВт) є окремою моделлю.
    let inverterKw, inverterModuleCount;
    if (isHybrid && inverterBasisKw > maxListKw) {
      inverterModuleCount = Math.ceil(inverterBasisKw / maxListKw);
      inverterKw = inverterModuleCount * maxListKw;
    } else {
      const candidates = list.filter((kw) => kw >= inverterBasisKw);
      inverterKw = candidates.length > 0 ? Math.min(...candidates) : maxListKw;
      inverterModuleCount = 1;
    }
    result.inverterKw = inverterKw;
    result.inverterModuleCount = inverterModuleCount;
    // Розмір ОДНОГО фізичного блока (для показу "2 × 50 кВт" і для пошуку
    // ціни за прайсом інвертора нижче) — при паралелі це maxListKw, інакше
    // збігається з inverterKw.
    result.inverterUnitKw = inverterModuleCount > 1 ? maxListKw : inverterKw;

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
    // --- 3b. Поелементна ціна станції (тільки режим «Ручний ввід обладнання») ---
    // Anna 2026-07-21: коли клієнт уже знає інвертор, рахуємо реальну ціну —
    // конкретний інвертор із data.inverterPricesMesh/Hybrid + вартість
    // матеріалів/робіт для цього розміру (priceRow.materialsLabor), а не
    // орієнтовну бандл-ціну price×кВт. Якщо для цієї потужності/типу немає
    // або ціни інвертора, або materialsLabor — тихо відкочуємось на бандл
    // (без попередження менеджеру, рішення Anna).
    let stationPriceSource = "bundle";
    if (manualInverterUsed) {
      // Ціну беремо за ОДИН фізичний блок (inverterUnitKw) і множимо на
      // кількість блоків (inverterModuleCount) — коректно і для звичайного
      // випадку (1 блок), і для паралелі гібридних блоків понад 50 кВт.
      const inverterCatalog = isHybrid ? data.inverterPricesHybrid : data.inverterPricesMesh;
      const inverterPriceRow = (inverterCatalog || []).find((r) => r.kw === result.inverterUnitKw);
      const unitPrice = inverterPriceRow
        ? (input.vat ? inverterPriceRow.priceVat : inverterPriceRow.priceNoVat)
        : null;
      const inverterUnitPrice = (unitPrice !== null && unitPrice !== undefined)
        ? unitPrice * inverterModuleCount
        : null;
      const materialsLabor = priceRow ? priceRow.materialsLabor : null;

      if (inverterUnitPrice !== null && inverterUnitPrice !== undefined &&
          materialsLabor !== null && materialsLabor !== undefined) {
        stationPrice = inverterUnitPrice + materialsLabor;
        pricePerKw = stationPowerKw > 0 ? stationPrice / stationPowerKw : pricePerKw;
        stationPriceSource = "itemized";
        result.inverterUnitPrice = inverterUnitPrice;
        result.materialsLaborPrice = materialsLabor;
      }
    }
    result.stationPriceSource = stationPriceSource;
    result.pricePerKw = pricePerKw;
    result.stationPrice = stationPrice;

    // --- 4. Панелі (C42) ---
    // Ручний ввід панелей — незалежний від інвертора (клієнт міг попросити
    // панелі "з запасом" понад потужність інвертора). Порожньо — як завжди,
    // від потужності станції (інвертора).
    const manualPanelUsed = !!(input.manualPanelKw && input.manualPanelKw > 0);
    const panelBasisKw = manualPanelUsed ? input.manualPanelKw : stationPowerKw;
    result.manualPanelUsed = manualPanelUsed;

    const panelCount = Math.ceil(panelBasisKw / c.panelPowerKw);
    result.panelCount = panelCount;
    result.panelTotalKw = panelCount * c.panelPowerKw;

    // Вартість панелей — окремо від ціни станції (у Дані ціна станції вже
    // не включає панелі), кількість Вт × ціна за Вт (ПДВ/без ПДВ).
    const panelWattage = c.panelPowerKw * 1000; // 615 Вт
    const panelPricePerW = input.vat ? data.panelPrice.vat : data.panelPrice.noVat;
    const panelCost = panelCount * panelWattage * panelPricePerW;
    result.panelWattage = panelWattage;
    result.panelPricePerW = panelPricePerW;
    result.panelCost = panelCost;

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
      // Ручний ввід ємності АКБ — минає розрахунок від годин автономії,
      // але модель і кількість модулів все одно підбираються автоматично.
      const manualAkbUsed = !!(input.manualAkbKwh && input.manualAkbKwh > 0);
      result.manualAkbUsed = manualAkbUsed;
      const requiredKwh = manualAkbUsed ? input.manualAkbKwh : (input.autonomyHours * dailyKwh / 24); // C29
      // Anna 2026-07-21: LV/HV — це фізичне обмеження САМОГО ІНВЕРТОРА (апаратне,
      // не залежить від потрібної ємності АКБ), тому й вирішується за обраним
      // inverterKw, а не за requiredKwh (стара версія могла підібрати LV-акумулятор
      // під HV-only інвертор при невеликій автономії — реальний баг, знайдений Anna
      // на прикладі 50 кВт). Поріг hvInverterKwThreshold=20: 5/10/15 кВт — LV,
      // 20 кВт і вище (включно з паралеллю 2×50 і т.д.) — HV.
      const bank = inverterKw >= c.hvInverterKwThreshold ? "HV" : "LV"; // C30
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
      total = stationPrice + panelCost + akbPart + mountTotal;
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
