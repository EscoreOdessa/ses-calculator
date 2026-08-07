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

      // Контакти менеджера з форми (якщо заповнені) — у шапку КП.
      const mgrPhone = ((document.getElementById("in-manager-phone") || {}).value || "").trim();
      const mgrEmail = ((document.getElementById("in-manager-email") || {}).value || "").trim();
      if (mgrPhone || mgrEmail) {
        const parts = [];
        if (mgrPhone) parts.push("тел.: " + mgrPhone);
        if (mgrEmail) parts.push("email: " + mgrEmail);
        el("kp-contacts").textContent = parts.join("  •  ");
      }
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
      if (r.panelCount) {
        rowsBody.appendChild(row("Розташування", cap(input.location)));
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

      // 2026-08-07: ціна = сума компонентів. Розбивка: інвертор + панелі +
      // АКБ + кріплення + матеріали + роботи + доставка.
      totalBody.appendChild(sectionRow("Орієнтовна вартість"));
      totalBody.appendChild(
        row(
          "Інвертор, $",
          (r.inverterPrice !== null && r.inverterPrice !== undefined) ? fmtUsd(r.inverterPrice).replace("$", "") : "—"
        )
      );
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
      if (r.materialsPrice !== null && r.materialsPrice !== undefined) {
        totalBody.appendChild(row("Матеріали, $", fmtUsd(r.materialsPrice).replace("$", "")));
      }
      if (r.laborPrice !== null && r.laborPrice !== undefined) {
        totalBody.appendChild(row("Роботи, $", fmtUsd(r.laborPrice).replace("$", "")));
      }
      if (r.deliveryPrice !== null && r.deliveryPrice !== undefined) {
        totalBody.appendChild(row("Доставка, $", fmtUsd(r.deliveryPrice).replace("$", "")));
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
