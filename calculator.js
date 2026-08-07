// calculator.js — логіка розрахунку потужності та ціни СЕС.
// Портовано з формул листа "Калькулятор" живої Google-таблиці.
// Чисті функції: (вхідні дані менеджера, довідкові дані) -> результат.
// Працює і в браузері (window.SesCalc), і в Node (module.exports) для тестів.

(function (root) {

  /**
   * @param {Object} input
   * @param {"consumption"|"equipment"} input.calcMode  Спосіб розрахунку:
   *   "consumption" — за місячним споживанням (варіант 1, як завжди);
   *   "equipment" — за бажаним обладнанням клієнта (варіант 2). У цьому
   *   режимі manualInverterKw/manualPanelKw/manualAkbKwh — НЕ оверрайди
   *   поверх авто-розрахунку, а єдине джерело: порожнє поле = клієнт не
   *   хоче це обладнання, воно повністю пропускається (не рахується, не
   *   додається в ціну), а не підставляється "як завжди".
   * @param {number} input.monthlyKwh        Місячне споживання, кВт·год (C4) — тільки для "consumption"
   * @param {"мережева"|"гібридна"} input.stationType  Тип станції (C5)
   * @param {"дах"|"земля"} input.location   Розташування (C6)
   * @param {boolean} input.vat              Форма оплати: true = з ПДВ, false = без ПДВ (C7)
   * @param {number} input.autonomyHours     Години автономії, тільки для "consumption"+гібридна (C8)
   * @param {string} input.roofType          Назва типу даху/кріплення з data.roofTypes (C43)
   * @param {number} [input.exchangeRate]    Курс, грн/$ (C24) — якщо не задано, тільки $ рахуються
   * @param {number} [input.manualInverterKw] Потужність інвертора — тільки для "equipment" (обов'язково для нього)
   * @param {number} [input.manualPanelKw]    Потужність панелей — тільки для "equipment" (порожньо = без панелей)
   * @param {number} [input.manualAkbKwh]     Ємність АКБ — тільки для "equipment" (порожньо = без АКБ)
   * @param {number} [input.manualAkbModuleCount] Кількість модулів АКБ вручну (обидва режими) — порожньо = автопідбір із запасом (akbModuleMargin)
   * @param {Object} data                    DEFAULT_DATA (або відредагована копія з localStorage)
   * @returns {Object} результат розрахунку — див. поля нижче
   */
  function calculate(input, data) {
    const c = data.constants;
    const calcMode = input.calcMode === "equipment" ? "equipment" : "consumption";
    const isEquipmentMode = calcMode === "equipment";
    // "Комплектація" (тільки для equipment-режиму, Anna 2026-07-22): "з монтажем"
    // (за замовчуванням, як і раніше — інвертор+матеріали/роботи+кріплення) чи
    // "тільки обладнання" (без матеріалів/робіт і без кріплення — панелі й АКБ
    // все одно рахуються, це фізичний товар, а не послуга монтажу). У
    // consumption-режимі перемикача нема — завжди "з монтажем" (бандл-ціна з
    // Дані і так невіддільна від монтажу).
    const withInstallation = isEquipmentMode ? input.withInstallation !== false : true;
    const result = { input, calcMode, withInstallation, warnings: [] };

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
    // "consumption": база підбору — цільова потужність від споживання.
    // "equipment": база — потужність, яку назвав клієнт (manualInverterKw);
    // якщо в цьому режимі поле порожнє — інвертор (і все, що з нього
    // рахується далі: ціна станції, панелі-за-замовчуванням) НЕ рахуємо.
    const isHybrid = input.stationType === "гібридна";
    const manualInverterUsed = isEquipmentMode && !!(input.manualInverterKw && input.manualInverterKw > 0);
    result.manualInverterUsed = manualInverterUsed;

    const list = isHybrid ? data.invertersHybrid : data.invertersMesh;
    const maxListKw = Math.max(...list);

    let inverterKw = null, inverterModuleCount = null;
    if (isEquipmentMode && !manualInverterUsed) {
      result.warnings.push("Вкажіть потужність інвертора — без неї станцію порахувати не можна.");
    } else {
      const inverterBasisKw = manualInverterUsed ? input.manualInverterKw : targetKw;
      // 2026-07-21 (рішення Anna): DEYE гібридні йдуть максимум по maxListKw
      // (зараз 50 кВт) за один блок. Для більшої потужності — паралель N
      // однакових блоків максимального розміру, округлення ВГОРУ (2×50=100,
      // 3×50=150...). Застосовується завжди, як тільки базова потужність
      // гібридної станції перевищує maxListKw — і в авто-розрахунку за
      // споживанням, і в ручному вводі. Мережеві (SolaX) так не рахуємо —
      // там кожен розмір зі списку (включно з 100кВт) є окремою моделлю.
      if (isHybrid && inverterBasisKw > maxListKw) {
        inverterModuleCount = Math.ceil(inverterBasisKw / maxListKw);
        inverterKw = inverterModuleCount * maxListKw;
      } else {
        const candidates = list.filter((kw) => kw >= inverterBasisKw);
        inverterKw = candidates.length > 0 ? Math.min(...candidates) : maxListKw;
        inverterModuleCount = 1;
      }
    }
    result.inverterKw = inverterKw;
    result.inverterModuleCount = inverterModuleCount;
    // Розмір ОДНОГО фізичного блока (для показу "2 × 50 кВт" і для пошуку
    // ціни за прайсом інвертора нижче) — при паралелі це maxListKw, інакше
    // збігається з inverterKw.
    result.inverterUnitKw = inverterKw === null ? null : (inverterModuleCount > 1 ? maxListKw : inverterKw);

    // --- 3. Ціна станції = сума компонентів (2026-08-07) ---
    // Новий принцип: інвертор + панелі + АКБ + кріплення + матеріали + роботи
    // + доставка. Ніякої «ціни за кВт». Панелі/АКБ/кріплення рахуються нижче
    // (розділи 4-6), тут — інвертор і матеріали/роботи/доставка.
    const stationPowerKw = inverterKw; // потужність станції = потужність інвертора
    result.stationPowerKw = stationPowerKw;

    // 3a. Ціна інвертора: ціна за модель × кількість фізичних блоків
    // (inverterModuleCount>1 — паралель однакових блоків максимального розміру).
    let inverterPrice = null;
    if (stationPowerKw !== null) {
      const inverterCatalog = isHybrid ? data.inverterPricesHybrid : data.inverterPricesMesh;
      const invRow = (inverterCatalog || []).find((r) => r.kw === result.inverterUnitKw);
      const unitPrice = invRow ? (input.vat ? invRow.priceVat : invRow.priceNoVat) : null;
      if (unitPrice !== null && unitPrice !== undefined) {
        inverterPrice = unitPrice * inverterModuleCount;
      } else {
        result.warnings.push("Немає ціни інвертора для цієї потужності — уточнити у менеджера.");
      }
    }
    result.inverterPrice = inverterPrice;

    // 3b. Матеріали / роботи / доставка — з таблиці station за
    // вид|розташування|оплата|потужність. Точний збіг за потужністю; якщо
    // немає — найближчий розмір у межах того самого вид+розташування+оплата
    // (напр. мережева 5 кВт, коли в таблиці лишили тільки 6 — не станеться,
    // але захист на випадок неповних даних). Тільки "з монтажем": при
    // "тільки обладнання" монтажні позиції в ціну не входять.
    let materialsPrice = null, laborPrice = null, deliveryPrice = null;
    if (stationPowerKw !== null && withInstallation) {
      const pool = (data.station || []).filter(
        (s) => s.type === input.stationType && s.location === input.location && s.vat === !!input.vat
      );
      let row = pool.find((s) => s.power === stationPowerKw);
      if (!row && pool.length) {
        row = pool.reduce((a, b) =>
          Math.abs(b.power - stationPowerKw) < Math.abs(a.power - stationPowerKw) ? b : a
        );
      }
      if (row) {
        materialsPrice = row.materials;
        laborPrice = row.labor;
        deliveryPrice = row.delivery;
      } else {
        result.warnings.push("Немає матеріалів/робіт/доставки для цієї комбінації вид/розташування/оплата — уточнити у менеджера.");
      }
    }
    result.materialsPrice = materialsPrice;
    result.laborPrice = laborPrice;
    result.deliveryPrice = deliveryPrice;

    // --- 4. Панелі (C42) ---
    // "consumption": як завжди, від потужності станції (інвертора).
    // "equipment": панелі рахуємо, ТІЛЬКИ якщо клієнт назвав їх потужність
    // (manualPanelKw>0). Порожнє поле в цьому режимі = клієнт не хоче
    // панелі — не рахуємо кількість/вартість/кріплення взагалі (не "0", а
    // відсутність розділу).
    const manualPanelUsed = isEquipmentMode && !!(input.manualPanelKw && input.manualPanelKw > 0);
    result.manualPanelUsed = manualPanelUsed;

    const panelsWanted = isEquipmentMode ? manualPanelUsed : true;

    let panelCount = null, panelTotalKw = null, panelWattage = null, panelPricePerW = null, panelCost = null;
    if (panelsWanted) {
      const panelBasisKw = manualPanelUsed ? input.manualPanelKw : stationPowerKw;
      panelCount = Math.ceil(panelBasisKw / c.panelPowerKw);
      panelTotalKw = panelCount * c.panelPowerKw;

      // Вартість панелей — окремо від ціни станції (у Дані ціна станції вже
      // не включає панелі), кількість Вт × ціна за Вт (ПДВ/без ПДВ).
      panelWattage = c.panelPowerKw * 1000; // 615 Вт
      panelPricePerW = input.vat ? data.panelPrice.vat : data.panelPrice.noVat;
      panelCost = panelCount * panelWattage * panelPricePerW;
    }
    result.panelCount = panelCount;
    result.panelTotalKw = panelTotalKw;
    result.panelWattage = panelWattage;
    result.panelPricePerW = panelPricePerW;
    result.panelCost = panelCost;

    // --- 5. Кріплення (C43-C45) ---
    // Кріплення має сенс, тільки якщо є панелі, І якщо обрано "з монтажем"
    // (це послуга/матеріали монтажу, як і materialsLabor вище — при "тільки
    // обладнання" не рахуємо, навіть якщо тип даху обрано).
    let mountPricePerPanel = null;
    let mountTotal = null;
    if (panelsWanted && withInstallation) {
      const roof = data.roofTypes.find((r) => r.name === input.roofType);
      if (roof) {
        mountPricePerPanel = roof.price * c.akbMarkup; // C44, з націнкою (не округлюється при рахунку)
        mountTotal = panelCount * mountPricePerPanel;   // C45
      } else {
        result.warnings.push("Не вибрано тип даху/кріплення — уточнити у менеджера.");
      }
    }
    result.mountPricePerPanel = mountPricePerPanel;
    result.mountTotal = mountTotal;

    // --- 6. Автономія та АКБ (C29-C39), тільки для гібридної ---
    // "consumption": як завжди, від годин автономії.
    // "equipment": АКБ рахуємо, ТІЛЬКИ якщо клієнт назвав ємність
    // (manualAkbKwh>0). Порожнє поле в цьому режимі = клієнт не хоче АКБ —
    // не підбираємо модель і не додаємо в ціну (без попередження, це не
    // помилка даних, а вибір клієнта).
    let akb = null;
    const manualAkbUsed = isEquipmentMode && !!(input.manualAkbKwh && input.manualAkbKwh > 0);
    result.manualAkbUsed = manualAkbUsed;
    const akbWanted = isHybrid && (isEquipmentMode ? manualAkbUsed : true);
    if (akbWanted && inverterKw === null) {
      // equipment-режим: клієнт назвав ємність АКБ, але не назвав інвертор —
      // LV/HV визначити нема від чого (це апаратне обмеження інвертора).
      result.warnings.push("Вкажіть потужність інвертора — без неї неможливо підібрати систему АКБ (LV/HV).");
    } else if (akbWanted) {
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
        // Фінальна кількість модулів — із запасом (C33: CEILING(req/0.7/cap)).
        // Anna 2026-07-22: запас іноді дає "зайвий" модуль на межі ємності
        // (напр. 5 кВт·год потреба + модуль 5.12 → авто 2 модулі через
        // запас). Модель підбирається завжди автоматично; кількість
        // модулів можна скоригувати вручну (manualAkbModuleCount), якщо
        // клієнт свідомо не хоче запас.
        const autoModuleCount = Math.ceil(requiredKwh / c.akbModuleMargin / chosen.capacity);
        const manualModuleUsed = !!(input.manualAkbModuleCount && input.manualAkbModuleCount > 0);
        const moduleCount = manualModuleUsed ? Math.max(1, Math.round(input.manualAkbModuleCount)) : autoModuleCount;
        const totalCapacityKwh = moduleCount * chosen.capacity;
        if (manualModuleUsed && totalCapacityKwh < requiredKwh) {
          result.warnings.push("Кількість модулів АКБ, вказана вручну, менша за розрахункову потребу (без запасу) — перевірте з клієнтом.");
        }

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
          autoModuleCount,
          manualModuleUsed,
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
    // Разом = сума лише тих розділів, що фактично порахувані. Станція
    // (інвертор) — єдина обов'язкова частина; панелі/АКБ/кріплення, коли
    // свідомо пропущені (equipment-режим, поле порожнє), додають 0 без
    // попереджень — це вибір клієнта, не прогалина в даних.
    let total = null;
    if (inverterPrice !== null) {
      let akbPart = 0;
      if (isHybrid) {
        if (akb) {
          akbPart = input.vat ? akb.kitPriceVat : akb.kitPriceNoVat;
        } else if (!isEquipmentMode) {
          // "consumption"-режим завжди мав дати АКБ (є години автономії) —
          // якщо не дав, це реальна прогалина, а не вибір клієнта.
          result.warnings.push("Немає АКБ для розрахунку підсумку — уточнити у менеджера.");
        }
        // isEquipmentMode && !akb — клієнт свідомо не хоче АКБ, попередження не потрібне.
      }
      // Разом = сума компонентів: інвертор + панелі + АКБ + кріплення +
      // матеріали + роботи + доставка (кожен доданок = 0, якщо розділу немає).
      total =
        inverterPrice +
        (panelCost !== null ? panelCost : 0) +
        akbPart +
        (mountTotal !== null ? mountTotal : 0) +
        (materialsPrice !== null ? materialsPrice : 0) +
        (laborPrice !== null ? laborPrice : 0) +
        (deliveryPrice !== null ? deliveryPrice : 0);
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
