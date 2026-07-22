// kp.js — формування комерційної пропозиції (КП) і друк/PDF на клієнті.
// Структура і текст рядків повторюють оригінальний генератор
// КП_AppsScript.gs (generateProposalPDF): лого окремо на білому, зелена
// плашка «КОМЕРЦІЙНА ПРОПОЗИЦІЯ», клієнт, компанія, контакти, № і дата,
// секції «Параметри станції» / «Комплект АКБ (автономія)» / «Орієнтовна
// вартість», підсумок жовтим.

(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  const fmtUsd = (n) => (n === null || n === undefined || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
  const fmtUah = (n) => (n === null || n === undefined || isNaN(n) ? "—" : Math.round(n).toLocaleString("uk-UA") + " грн");
  const fmtNum = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? "—" : n.toFixed(d));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  ready(() => {
    const el = (id) => document.getElementById(id);

    el("kp-logo").src = "data:image/png;base64," + ESCORE_LOGO_B64;

    function row(label, value) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.className = "kp-label";
      td1.textContent = label;
      const td2 = document.createElement("td");
      td2.className = "kp-value";
      td2.textContent = value;
      tr.appendChild(td1);
      tr.appendChild(td2);
      return tr;
    }

    function sectionRow(label) {
      const tr = document.createElement("tr");
      tr.className = "kp-section";
      const td = document.createElement("td");
      td.colSpan = 2;
      td.textContent = label;
      tr.appendChild(td);
      return tr;
    }

    function pad2(n) {
      return String(n).padStart(2, "0");
    }

    function proposalNumber(d) {
      return (
        "КП-" +
        String(d.getFullYear()).slice(2) +
        pad2(d.getMonth() + 1) +
        pad2(d.getDate()) +
        "-" +
        pad2(d.getHours()) +
        pad2(d.getMinutes())
      );
    }

    function build() {
      const app = window.SesApp;
      const r = app ? app.getLastResult() : null;
      const rowsBody = el("kp-rows");
      const totalBody = el("kp-total-rows");
      rowsBody.innerHTML = "";
      totalBody.innerHTML = "";

      const now = new Date();
      const clientName = (document.getElementById("in-client") || {}).value || "";
      el("kp-client").textContent = clientName || "";
      el("kp-num").textContent = "№ " + proposalNumber(now);
      el("kp-doc-date").textContent =
        "Дата: " + pad2(now.getDate()) + "." + pad2(now.getMonth() + 1) + "." + now.getFullYear();

      if (!r) {
        rowsBody.appendChild(row("Немає даних", "спочатку порахуйте на вкладці «Калькулятор»"));
        return;
      }

      const input = r.input;
      const isHybrid = input.stationType === "гібридна";
      const isEquipment = r.calcMode === "equipment";

      rowsBody.appendChild(sectionRow("Параметри станції"));
      rowsBody.appendChild(row("Тип станції", cap(input.stationType)));
      rowsBody.appendChild(row("Розташування", cap(input.location)));
      if (!isEquipment) {
        rowsBody.appendChild(row("Потужність станції, кВт", r.targetKw.toFixed(1)));
      }
      rowsBody.appendChild(
        row(
          "Інвертор " + (isHybrid ? "DEYE" : "SolaX Power") + ", кВт",
          r.inverterKw !== null ? String(r.inverterKw) : "уточнити у менеджера"
        )
      );
      if (r.panelCount) {
        rowsBody.appendChild(
          row(
            "Панелі (" + r.panelWattage + " Вт/шт)",
            r.panelCount + " шт ≈ " + fmtNum(r.panelTotalKw) + " кВт"
          )
        );
      }

      if (isHybrid && (r.akb || !isEquipment)) {
        rowsBody.appendChild(sectionRow("Комплект АКБ (автономія)"));
        if (!isEquipment) {
          rowsBody.appendChild(row("Години автономії", String(input.autonomyHours)));
        }
        if (r.akb) {
          rowsBody.appendChild(row("Необхідна ємність АКБ, кВт·год", r.akb.requiredKwh.toFixed(1)));
          rowsBody.appendChild(row("Модель АКБ", r.akb.model));
          rowsBody.appendChild(row("Ємність одного модуля, кВт·год", String(r.akb.moduleCapacityKwh)));
          rowsBody.appendChild(row("Кількість модулів, шт", String(r.akb.moduleCount)));
        }
      }

      totalBody.appendChild(sectionRow("Орієнтовна вартість"));
      totalBody.appendChild(row("Станція, $", r.stationPrice !== null ? fmtUsd(r.stationPrice).replace("$", "") : "—"));
      if (r.panelCount) {
        totalBody.appendChild(row("Панелі, $", r.panelCost !== null ? fmtUsd(r.panelCost).replace("$", "") : "—"));
      }
      if (isHybrid && r.akb) {
        totalBody.appendChild(
          row(
            "Комплект АКБ (" + (input.vat ? "з ПДВ" : "готівка") + "), $",
            fmtUsd(input.vat ? r.akb.kitPriceVat : r.akb.kitPriceNoVat).replace("$", "")
          )
        );
      }
      if (r.panelCount) {
        if (r.mountTotal !== null) {
          totalBody.appendChild(row("Кріплення, $", fmtUsd(r.mountTotal).replace("$", "")));
        } else {
          totalBody.appendChild(row("Кріплення", "уточнити у менеджера"));
        }
      }

      const totalRow = row("РАЗОМ, $", r.totalUsd !== null ? fmtUsd(r.totalUsd).replace("$", "") : "уточнити у менеджера");
      totalRow.className = "kp-grand";
      totalBody.appendChild(totalRow);

      if (r.totalUah !== null) {
        const uahRow = row("РАЗОМ, грн (курс " + input.exchangeRate + ")", Math.round(r.totalUah).toLocaleString("uk-UA"));
        uahRow.className = "kp-grand";
        totalBody.appendChild(uahRow);
      }
    }

    document.querySelectorAll('.tab-btn[data-tab="kp"]').forEach((btn) => {
      btn.addEventListener("click", build);
    });

    el("kp-print").addEventListener("click", () => {
      build();
      window.print();
    });

    build();
  });
})();
