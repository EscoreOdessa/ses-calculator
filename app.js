// app.js — вкладки + жива прив'язка форми калькулятора до calculator.js

(function () {
  // ---------- Таби ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- Форматування ----------
  const fmtUsd = (n) => (n === null || n === undefined || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
  const fmtUah = (n) => (n === null || n === undefined || isNaN(n) ? "—" : Math.round(n).toLocaleString("uk-UA") + " грн");
  const fmtNum = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? "—" : n.toFixed(d));

  // ---------- Довідкові дані («Дані»), з localStorage або початкові ----------
  let currentData = SesStorage.load();

  function getData() {
    return currentData;
  }

  function setData(newData) {
    currentData = newData;
  }

  function onDataChanged() {
    SesStorage.save(currentData);
    refreshRoofOptions();
    render();
    document.dispatchEvent(new CustomEvent("ses:datachanged"));
  }

  let lastResult = null;

  // Доступ для dani.js / panels.js / production.js
  window.SesApp = {
    getData,
    setData,
    onDataChanged,
    getLastResult: () => lastResult,
    getCoordsText: () => el("in-coords").value.trim(),
  };

  const el = (id) => document.getElementById(id);

  function refreshRoofOptions() {
    const roofSelect = el("in-roof");
    const prev = roofSelect.value;
    roofSelect.innerHTML = "";
    currentData.roofTypes.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.name;
      opt.textContent = `${r.name} ($${r.price}/панель)`;
      roofSelect.appendChild(opt);
    });
    const names = currentData.roofTypes.map((r) => r.name);
    roofSelect.value = names.includes(prev) ? prev : names.includes("Пласкій дах") ? "Пласкій дах" : names[0] || "";
  }

  refreshRoofOptions();

  function readInput() {
    return {
      calcMode: el("in-mode").value,
      monthlyKwh: parseFloat(el("in-monthly").value) || 0,
      stationType: el("in-type").value,
      location: el("in-location").value,
      vat: el("in-vat").value === "1",
      autonomyHours: parseFloat(el("in-hours").value) || 0,
      roofType: el("in-roof").value,
      exchangeRate: parseFloat(el("in-rate").value) || null,
      manualInverterKw: parseFloat(el("in-manual-inverter").value) || null,
      manualPanelKw: parseFloat(el("in-manual-panel").value) || null,
      manualAkbKwh: parseFloat(el("in-manual-akb").value) || null,
      withInstallation: el("in-install").value === "1",
      manualAkbModuleCount: parseFloat(el("in-manual-akbmodules").value) || null,
    };
  }

  function render() {
    const input = readInput();
    const isHybrid = input.stationType === "гібридна";
    const isEquipment = input.calcMode === "equipment";

    el("field-monthly").style.display = isEquipment ? "none" : "";
    el("card-manual-equipment").style.display = isEquipment ? "" : "none";
    el("card-power").style.display = isEquipment ? "none" : "";
    el("field-autonomy").style.display = isHybrid && !isEquipment ? "" : "none";
    el("field-manual-akb").style.display = isHybrid ? "" : "none";
    // "Комплектація" (з монтажем / тільки обладнання) має сенс тільки в equipment-режимі.
    el("field-install").style.display = isEquipment ? "" : "none";
    el("row-inverterprice").style.display = isEquipment ? "" : "none";
    el("row-materialslabor").style.display = isEquipment ? "" : "none";
    // "Станція, $" дублює "Ціна інвертора"+"Матеріали та роботи" в equipment-режимі — ховаємо там.
    el("row-stationprice").style.display = isEquipment ? "none" : "";

    const r = SesCalc.calculate(input, currentData);
    lastResult = r;

    // Кріплення/тип даху мають сенс, тільки якщо панелі фактично рахуються
    // І обрано "з монтажем" (equipment-режим, "тільки обладнання" — без кріплень).
    el("field-roof").style.display = r.panelCount !== null ? "" : "none";
    el("card-mount").style.display = r.panelCount !== null && r.withInstallation ? "" : "none";
    // Блок вибору АКБ (у "Підбір обладнання"): у consumption-режимі завжди
    // показуємо для гібридної; у equipment-режимі — тільки якщо клієнт
    // справді назвав ємність. Рядок ціни АКБ (у "Орієнтовна ціна станції") —
    // за тим самим принципом.
    el("block-akb-select").style.display = isHybrid && (!isEquipment || r.akb) ? "" : "none";
    el("row-akbprice").style.display = isHybrid && r.akb ? "" : "none";

    el("out-daily").textContent = fmtNum(r.dailyKwh);
    el("out-day").textContent = fmtNum(r.dayKwh);
    el("out-night").textContent = fmtNum(r.nightKwh);
    el("out-target").textContent = fmtNum(r.targetKw);

    const inverterBrand = isHybrid ? "DEYE" : "SolaX Power";
    if (r.inverterKw === null) {
      el("out-inverter").textContent = "— (вкажіть потужність інвертора)";
    } else {
      const inverterSizeText = r.inverterModuleCount > 1
        ? `${r.inverterModuleCount} × ${r.inverterUnitKw} кВт (паралель) = ${r.inverterKw} кВт`
        : `${r.inverterKw} кВт`;
      el("out-inverter").textContent = `${inverterBrand}, ${inverterSizeText}`
        + (r.manualInverterUsed ? " (вручну)" : "");
    }
    el("out-panels").textContent = r.panelCount !== null
      ? `${r.panelCount} шт × ${r.panelWattage} Вт ≈ ${fmtNum(r.panelTotalKw)} кВт` + (r.manualPanelUsed ? " (вручну)" : "")
      : "— (клієнт не хоче панелі)";

    el("out-inverterprice").textContent = (r.inverterUnitPrice !== null && r.inverterUnitPrice !== undefined) ? fmtUsd(r.inverterUnitPrice) : "—";
    if (r.materialsLaborPrice === null || r.materialsLaborPrice === undefined) {
      el("out-materialslabor").textContent = "—";
    } else if (!r.withInstallation) {
      el("out-materialslabor").textContent = "не враховано (тільки обладнання)";
    } else {
      el("out-materialslabor").textContent = fmtUsd(r.materialsLaborPrice);
    }
    el("out-priceperkw").textContent = r.pricePerKw !== null ? fmtUsd(r.pricePerKw) : "уточнити у менеджера";
    el("out-stationprice").textContent = r.stationPrice !== null ? fmtUsd(r.stationPrice) : "уточнити у менеджера";
    el("out-panelpricew").textContent = r.panelPricePerW !== null ? "$" + r.panelPricePerW.toFixed(2) : "—";
    el("out-panelcost").textContent = r.panelCost !== null ? fmtUsd(r.panelCost) : "—";

    if (isHybrid && r.akb) {
      el("out-akbreq").textContent = fmtNum(r.akb.requiredKwh) + " кВт·год" + (r.manualAkbUsed ? " (вручну)" : "");
      el("out-akbbank").textContent = r.akb.bank;
      el("out-akbmodel").textContent = r.akb.model;
      el("out-akbcount").textContent = r.akb.moduleCount + " шт" + (r.akb.manualModuleUsed ? " (вручну)" : "");
      el("in-manual-akbmodules").placeholder = "авто (" + r.akb.autoModuleCount + " шт)";
      el("out-akbtotal").textContent = fmtNum(r.akb.totalCapacityKwh) + " кВт·год";
      el("out-akbrack").textContent = r.akb.bank === "HV" ? `${r.akb.bms} × ${r.akb.rackCount} / ${r.akb.rack}` : "—";
      el("out-akbprice").textContent = fmtUsd(input.vat ? r.akb.kitPriceVat : r.akb.kitPriceNoVat);
    } else if (isHybrid) {
      ["out-akbreq", "out-akbbank", "out-akbmodel", "out-akbcount", "out-akbtotal", "out-akbrack", "out-akbprice"].forEach((id) => {
        el(id).textContent = "—";
      });
      el("in-manual-akbmodules").placeholder = "авто";
    }

    el("out-mountperpanel").textContent = r.mountPricePerPanel !== null ? fmtUsd(r.mountPricePerPanel) : "—";
    el("out-mounttotal").textContent = r.mountTotal !== null ? fmtUsd(r.mountTotal) : "—";

    // Ціна за кВт у підсумку: якщо є панелі — рахуємо від їх сумарної
    // потужності; якщо панелей немає (equipment-режим без панелей) —
    // від потужності інвертора (рішення Anna 2026-07-22).
    let perKw = null;
    if (r.totalUsd !== null) {
      if (r.panelCount && r.panelTotalKw) {
        perKw = r.totalUsd / r.panelTotalKw;
      } else if (r.inverterKw) {
        perKw = r.totalUsd / r.inverterKw;
      }
    }
    el("out-totalperkw").textContent = perKw !== null ? fmtUsd(perKw) : "—";
    el("out-totalusd").textContent = r.totalUsd !== null ? fmtUsd(r.totalUsd) : "уточнити у менеджера";
    el("out-totaluah").textContent = r.totalUah !== null ? fmtUah(r.totalUah) : "—";

    const warnBox = el("calc-warnings");
    warnBox.innerHTML = "";
    r.warnings.forEach((w) => {
      const div = document.createElement("div");
      div.className = "warning";
      div.textContent = w;
      warnBox.appendChild(div);
    });
  }

  document.querySelectorAll("#panel-calc input, #panel-calc select").forEach((elm) => {
    elm.addEventListener("input", render);
    elm.addEventListener("change", render);
  });

  render();
})();
