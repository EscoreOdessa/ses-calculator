// storage.js — зберігання відредагованих довідкових даних («Дані») у браузері.
// Дані живуть у localStorage конкретного браузера/пристрою (сайт статичний,
// без сервера). Кнопки «Експорт/Імпорт JSON» дозволяють перенести дані
// на інший комп'ютер або зробити резервну копію.

const SesStorage = (function () {
  const KEY = "ses_calculator_data_v1";

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      // На випадок якщо в збереженому JSON бракує якогось розділу (наприклад,
      // після оновлення сайту з'явився новий розділ) — доповнюємо з DEFAULT_DATA.
      return Object.assign(clone(DEFAULT_DATA), parsed);
    } catch (e) {
      console.error("Не вдалося прочитати збережені дані, використовую початкові.", e);
      return clone(DEFAULT_DATA);
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function reset() {
    localStorage.removeItem(KEY);
    return clone(DEFAULT_DATA);
  }

  function isModified() {
    return localStorage.getItem(KEY) !== null;
  }

  function exportJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ses-dani-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importJson(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const merged = Object.assign(clone(DEFAULT_DATA), parsed);
        save(merged);
        onDone(null, merged);
      } catch (e) {
        onDone(e, null);
      }
    };
    reader.onerror = () => onDone(reader.error, null);
    reader.readAsText(file);
  }

  return { load, save, reset, isModified, exportJson, importJson };
})();
