// dani.js — редаговані таблиці довідкових даних (вкладка «Дані»).
// Працює поверх window.SesApp (див. app.js): getData() повертає поточні дані,
// onDataChanged() зберігає їх у localStorage і перераховує калькулятор.

(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(() => {
    const { getData, onDataChanged } = window.SesApp;

    function el(id) {
      return document.getElementById(id);
    }

    function cellInput(type, value, onInput, opts) {
      let input;
      if (type === "select") {
        input = document.createElement("select");
        opts.forEach(([val, label]) => {
          const o = document.createElement("option");
          o.value = val;
          o.textContent = label;
          if (String(val) === String(value)) o.selected = true;
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input");
        input.type = type;
        if (type === "number") input.step = "any";
        input.value = value;
      }
      input.addEventListener("change", () => onInput(input.value));
      const td = document.createElement("td");
      td.appendChild(input);
      return td;
    }

    /**
     * @param {string} tableId
     * @param {Array<{key:string,label:string,type:'text'|'number'|'select',opts?:Array}>} columns
     * @param {Array<object>} rows
     * @param {function} onRowChange  (rowIndex, key, rawValue) — мутує rows[rowIndex][key]
     * @param {function} onRowDelete  (rowIndex)
     */
    function renderTable(tableId, columns, rows, onRowChange, onRowDelete) {
      const table = el(tableId);
      table.innerHTML = "";

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach((c) => {
        const th = document.createElement("th");
        th.textContent = c.label;
        headRow.appendChild(th);
      });
      headRow.appendChild(document.createElement("th"));
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      rows.forEach((row, i) => {
        const tr = document.createElement("tr");
        columns.forEach((c) => {
          const td = cellInput(
            c.type,
            row[c.key],
            (val) => onRowChange(i, c.key, val),
            c.opts
          );
          tr.appendChild(td);
        });
        const delTd = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.className = "row-del";
        delBtn.textContent = "✕";
        delBtn.title = "Видалити рядок";
        delBtn.addEventListener("click", () => onRowDelete(i));
        delTd.appendChild(delBtn);
        tr.appendChild(delTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    function num(v, fallback = 0) {
      const n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    }

    function updateStatus() {
      el("dani-status").textContent = SesStorage.isModified()
        ? "Використовуються відредаговані дані (збережено у цьому браузері)."
        : "Використовуються початкові дані.";
    }

    document.addEventListener("ses:datachanged", updateStatus);

    function renderAll() {
      const data = getData();
      updateStatus();

      // --- Ціни станцій ---
      renderTable(
        "dani-prices-table",
        [
          { key: "type", label: "Вид", type: "select", opts: [["мережева", "Мережева"], ["гібридна", "Гібридна"]] },
          { key: "location", label: "Розташування", type: "select", opts: [["дах", "Дах"], ["земля", "Земля"]] },
          { key: "vat", label: "Оплата", type: "select", opts: [["true", "ПДВ"], ["false", ""]] },
          { key: "power", label: "Потужність, кВт", type: "number" },
          { key: "price", label: "Ціна, $/кВт", type: "number" },
          { key: "materialsLabor", label: "Матеріали+робота (сума, не за кВт), $", type: "number" },
        ],
        data.prices,
        (i, key, val) => {
          if (key === "vat") data.prices[i][key] = val === "true";
          else if (key === "materialsLabor") data.prices[i][key] = val === "" ? null : num(val);
          else if (key === "power" || key === "price") data.prices[i][key] = num(val);
          else data.prices[i][key] = val;
          onDataChanged();
        },
        (i) => {
          data.prices.splice(i, 1);
          renderAll();
          onDataChanged();
        }
      );

      // --- Типи даху ---
      renderTable(
        "dani-roof-table",
        [
          { key: "name", label: "Назва", type: "text" },
          { key: "price", label: "Ціна за панель, $", type: "number" },
          {
            key: "adjustableTilt",
            label: "Кут кріплень",
            type: "select",
            opts: [
              ["true", "Стійки, кут обирається (15/20/30°)"],
              ["false", "Впритул до схилу даху (кут невідомий)"],
            ],
          },
        ],
        data.roofTypes,
        (i, key, val) => {
          if (key === "price") data.roofTypes[i][key] = num(val);
          else if (key === "adjustableTilt") data.roofTypes[i][key] = val === "true";
          else data.roofTypes[i][key] = val;
          onDataChanged();
        },
        (i) => {
          data.roofTypes.splice(i, 1);
          renderAll();
          onDataChanged();
        }
      );

      // --- Інвертори ---
      el("dani-inv-mesh").value = data.invertersMesh.join(", ");
      el("dani-inv-hybrid").value = data.invertersHybrid.join(", ");

      // --- Ціни інверторів (Ручний ввід обладнання) ---
      const invPriceCols = [
        { key: "kw", label: "Потужність, кВт", type: "number" },
        { key: "priceVat", label: "Ціна з ПДВ, $", type: "number" },
        { key: "priceNoVat", label: "Ціна без ПДВ, $", type: "number" },
      ];
      const invPriceOnChange = (arrName) => (i, key, val) => {
        data[arrName][i][key] = val === "" ? null : num(val, null);
        onDataChanged();
      };
      const invPriceOnDelete = (arrName) => (i) => {
        data[arrName].splice(i, 1);
        renderAll();
        onDataChanged();
      };
      if (!data.inverterPricesMesh) data.inverterPricesMesh = [];
      if (!data.inverterPricesHybrid) data.inverterPricesHybrid = [];
      renderTable(
        "dani-inv-mesh-price-table",
        invPriceCols,
        data.inverterPricesMesh,
        invPriceOnChange("inverterPricesMesh"),
        invPriceOnDelete("inverterPricesMesh")
      );
      renderTable(
        "dani-inv-hybrid-price-table",
        invPriceCols,
        data.inverterPricesHybrid,
        invPriceOnChange("inverterPricesHybrid"),
        invPriceOnDelete("inverterPricesHybrid")
      );

      // --- Ціна панелей ---
      el("dani-panel-novat").value = data.panelPrice.noVat;
      el("dani-panel-vat").value = data.panelPrice.vat;

      // --- Акумулятори LV ---
      renderTable(
        "dani-lv-table",
        [
          { key: "model", label: "Модель", type: "text" },
          { key: "desc", label: "Опис", type: "text" },
          { key: "capacity", label: "Ємність, кВт·год", type: "number" },
          { key: "voltage", label: "Напруга, В", type: "number" },
          { key: "priceVat", label: "Ціна з ПДВ, $", type: "number" },
          { key: "priceNoVat", label: "Ціна без ПДВ, $", type: "number" },
        ],
        data.batteriesLV,
        (i, key, val) => {
          const numeric = ["capacity", "voltage", "priceVat", "priceNoVat"];
          data.batteriesLV[i][key] = numeric.includes(key) ? num(val) : val;
          onDataChanged();
        },
        (i) => {
          data.batteriesLV.splice(i, 1);
          renderAll();
          onDataChanged();
        }
      );

      // --- Акумулятори HV ---
      renderTable(
        "dani-hv-table",
        [
          { key: "model", label: "Модель", type: "text" },
          { key: "desc", label: "Опис", type: "text" },
          { key: "capacity", label: "Ємність, кВт·год", type: "number" },
          { key: "priceVat", label: "Ціна з ПДВ, $", type: "number" },
          { key: "priceNoVat", label: "Ціна без ПДВ, $", type: "number" },
          { key: "bms", label: "BMS модель", type: "text" },
          { key: "bmsPriceVat", label: "BMS з ПДВ, $", type: "number" },
          { key: "bmsPriceNoVat", label: "BMS без ПДВ, $", type: "number" },
          { key: "batteriesPerRack", label: "Батарей/стійку", type: "number" },
          { key: "rack", label: "Стійка модель", type: "text" },
          { key: "rackPriceVat", label: "Стійка з ПДВ, $", type: "number" },
          { key: "rackPriceNoVat", label: "Стійка без ПДВ, $", type: "number" },
        ],
        data.batteriesHV,
        (i, key, val) => {
          const numeric = ["capacity", "priceVat", "priceNoVat", "bmsPriceVat", "bmsPriceNoVat", "batteriesPerRack", "rackPriceVat", "rackPriceNoVat"];
          data.batteriesHV[i][key] = numeric.includes(key) ? num(val) : val;
          onDataChanged();
        },
        (i) => {
          data.batteriesHV.splice(i, 1);
          renderAll();
          onDataChanged();
        }
      );
    }

    // --- Інвертори: збереження при зміні тексту ---
    el("dani-inv-mesh").addEventListener("change", () => {
      const data = getData();
      data.invertersMesh = el("dani-inv-mesh").value
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      onDataChanged();
    });
    el("dani-inv-hybrid").addEventListener("change", () => {
      const data = getData();
      data.invertersHybrid = el("dani-inv-hybrid").value
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      onDataChanged();
    });

    // --- Ціна панелей: збереження при зміні ---
    el("dani-panel-novat").addEventListener("change", () => {
      const data = getData();
      data.panelPrice.noVat = num(el("dani-panel-novat").value, data.panelPrice.noVat);
      onDataChanged();
    });
    el("dani-panel-vat").addEventListener("change", () => {
      const data = getData();
      data.panelPrice.vat = num(el("dani-panel-vat").value, data.panelPrice.vat);
      onDataChanged();
    });

    // --- Кнопки додавання рядків ---
    el("dani-add-price").addEventListener("click", () => {
      getData().prices.push({ type: "мережева", location: "дах", vat: false, power: 50, price: 0 });
      renderAll();
      onDataChanged();
    });
    el("dani-add-inv-mesh-price").addEventListener("click", () => {
      getData().inverterPricesMesh.push({ kw: 0, priceVat: 0, priceNoVat: 0 });
      renderAll();
      onDataChanged();
    });
    el("dani-add-inv-hybrid-price").addEventListener("click", () => {
      getData().inverterPricesHybrid.push({ kw: 0, priceVat: 0, priceNoVat: 0 });
      renderAll();
      onDataChanged();
    });
    el("dani-add-roof").addEventListener("click", () => {
      getData().roofTypes.push({ name: "Новий тип", price: 0, adjustableTilt: true });
      renderAll();
      onDataChanged();
    });
    el("dani-add-lv").addEventListener("click", () => {
      getData().batteriesLV.push({ model: "Нова модель", desc: "", capacity: 0, voltage: 51.2, priceVat: 0, priceNoVat: 0 });
      renderAll();
      onDataChanged();
    });
    el("dani-add-hv").addEventListener("click", () => {
      getData().batteriesHV.push({
        model: "Нова модель", desc: "", capacity: 0, priceVat: 0, priceNoVat: 0,
        bms: "", bmsPriceVat: 0, bmsPriceNoVat: 0,
        rack: "", batteriesPerRack: 1, rackPriceVat: 0, rackPriceNoVat: 0,
      });
      renderAll();
      onDataChanged();
    });

    // --- Експорт / Імпорт / Скидання ---
    el("dani-export").addEventListener("click", () => {
      SesStorage.exportJson(getData());
    });

    el("dani-import-file").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      SesStorage.importJson(file, (err, merged) => {
        if (err) {
          alert("Не вдалося прочитати файл: " + err.message);
          return;
        }
        window.SesApp.setData(merged);
        renderAll();
        onDataChanged();
        el("dani-import-file").value = "";
      });
    });

    el("dani-reset").addEventListener("click", () => {
      if (!confirm("Скинути всі відредаговані дані до початкових значень?")) return;
      const fresh = SesStorage.reset();
      window.SesApp.setData(fresh);
      renderAll();
      onDataChanged();
    });

    renderAll();
  });
})();
