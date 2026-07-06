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
      monthlyKwh: parseFloat(el("in-monthly").value) || 0,
      stationType: el("in-type").value,
      location: el("in-location").value,
      vat: el("in-vat").value === "1",
      autonomyHours: parseFloat(el("in-hours").value) || 0,
      roofType: el("in-roof").value,
      exchangeRate: parseFloat(el("in-rate").value) || null,
    };
  }

  function render() {
    const input = readInput();
    const isHybrid = input.stationType === "гібридна";
    el("field-autonomy").style.display = isHybrid ? "" : "none";
    el("card-akb").style.display = isHybrid ? "" : "none";

    const r = SesCalc.calculate(input, currentData);
    lastResult = r;

    el("out-daily").textContent = fmtNum(r.dailyKwh);
    el("out-day").textContent = fmtNum(r.dayKwh);
    el("out-night").textContent = fmtNum(r.nightKwh);
    el("out-target").textContent = fmtNum(r.targetKw);

    el("out-inverter").textContent = r.inverterKw + " кВт";
    el("out-panels").textContent = `${r.panelCount} шт × 620 Вт ≈ ${fmtNum(r.panelTotalKw)} кВт`;

    el("out-priceperkw").textContent = r.pricePerKw !== null ? fmtUsd(r.pricePerKw) : "уточнити у менеджера";
    el("out-stationprice").textContent = r.stationPrice !== null ? fmtUsd(r.stationPrice) : "уточнити у менеджера";

    if (isHybrid && r.akb) {
      el("out-akbreq").textContent = fmtNum(r.akb.requiredKwh) + " кВт·год";
      el("out-akbbank").textContent = r.akb.bank;
      el("out-akbmodel").textContent = r.akb.model;
      el("out-akbcount").textContent = r.akb.moduleCount + " шт";
      el("out-akbtotal").textContent = fmtNum(r.akb.totalCapacityKwh) + " кВт·год";
      el("out-akbrack").textContent = r.akb.bank === "HV" ? `${r.akb.bms} × ${r.akb.rackCount} / ${r.akb.rack}` : "—";
      el("out-akbprice").textContent = fmtUsd(input.vat ? r.akb.kitPriceVat : r.akb.kitPriceNoVat);
    }

    el("out-mountperpanel").textContent = r.mountPricePerPanel !== null ? fmtUsd(r.mountPricePerPanel) : "—";
    el("out-mounttotal").textContent = r.mountTotal !== null ? fmtUsd(r.mountTotal) : "—";

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
