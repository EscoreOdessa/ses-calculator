// assistant.js — вкладка «Помічник» калькулятора ESCORE.
// Обращается к ОТДЕЛЬНОМУ Worker-бэкенду (ses-assistant) за ответами.
// Логику калькулятора не трогает: работает только внутри своей панели #panel-assistant.
(function () {
  "use strict";

  // === НАСТРОЙКА: адрес бэкенда-помощника (отдельный Worker) ===
  // После деплоя ses-assistant подставьте сюда его URL + /api/ask.
  // Можно переопределить, задав window.ASSISTANT_API до загрузки этого файла.
  var ASSISTANT_API =
    window.ASSISTANT_API || "https://ses-assistant.anna-escore.workers.dev/api/ask";
  // Адрес фидбэка выводим из ASSISTANT_API (…/ask → …/feedback).
  var FEEDBACK_API = ASSISTANT_API.replace(/\/ask(\?.*)?$/, "/feedback");

  // Стили вкладки — инжектируются здесь, чтобы не трогать style.css.
  var css =
    ".asst-chat{display:flex;flex-direction:column;gap:12px;min-height:220px;max-height:52vh;overflow-y:auto;padding:4px 2px 10px}" +
    ".asst-msg{padding:11px 14px;border-radius:13px;max-width:88%;line-height:1.5;white-space:pre-wrap}" +
    ".asst-user{align-self:flex-end;background:#2c6b80;color:#fff;border-bottom-right-radius:4px}" +
    ".asst-bot{align-self:flex-start;background:#f1f5f6;border:1px solid #e2e8ea;border-bottom-left-radius:4px}" +
    ".asst-bot.typing{color:#6b7b82;font-style:italic}" +
    ".asst-src{align-self:flex-start;max-width:88%;font-size:12px;color:#6b7b82}" +
    ".asst-src b{color:#1f4e5f}" +
    ".asst-badge{display:inline-block;font-size:11px;padding:1px 6px;border-radius:8px;background:#eef3f4;color:#1f4e5f;margin-right:4px}" +
    ".asst-badge.warn{background:#fff3c4;color:#b7791f}" +
    ".asst-bar{display:flex;gap:8px;margin-top:10px}" +
    ".asst-bar textarea{flex:1;resize:none;border:1px solid #cfd8db;border-radius:10px;padding:10px 12px;font:inherit}" +
    ".asst-fb{align-self:flex-start;display:flex;gap:8px;align-items:center;font-size:12px;color:#6b7b82}" +
    ".asst-fb button{background:#eef3f4;color:#1f4e5f;border:1px solid #e2e8ea;border-radius:8px;padding:2px 10px;font:inherit;cursor:pointer;width:auto}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var chat, input, send, greeted = false;

  function el(cls, text) {
    var d = document.createElement("div");
    d.className = cls;
    if (text != null) d.textContent = text;
    chat.appendChild(d);
    d.scrollIntoView({ block: "end", behavior: "smooth" });
    return d;
  }

  function addSources(sources) {
    if (!sources || !sources.length) return;
    var d = document.createElement("div");
    d.className = "asst-src";
    var items = sources
      .map(function (s) {
        var w = s.status === "confirm" ? " warn" : "";
        var mark = s.status === "confirm" ? " ⚠" : "";
        return '<span class="asst-badge' + w + '">' + s.id + mark + "</span>" + s.question;
      })
      .join("<br>");
    d.innerHTML = "<b>Джерела:</b><br>" + items;
    chat.appendChild(d);
    d.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function addFeedback(logId) {
    if (!logId) return;
    var d = document.createElement("div");
    d.className = "asst-fb";
    var label = document.createElement("span");
    label.textContent = "Відповідь допомогла?";
    d.appendChild(label);
    [["up", "👍 Так"], ["down", "👎 Ні"]].forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = pair[1];
      b.addEventListener("click", function () {
        d.innerHTML = "<span>Дякую, врахуємо.</span>";
        try {
          fetch(FEEDBACK_API, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ log_id: logId, value: pair[0] }),
          });
        } catch (e) {}
      });
      d.appendChild(b);
    });
    chat.appendChild(d);
    d.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function greet() {
    if (greeted) return;
    greeted = true;
    el(
      "asst-msg asst-bot",
      "Вітаю! Напишіть питання клієнта як є — наприклад «за скільки окупиться станція?» або «а взимку воно працює?». Відповім простою мовою і покажу, з яких карток узято відповідь."
    );
  }

  async function ask() {
    var text = (input.value || "").trim();
    if (!text) return;
    el("asst-msg asst-user", text);
    input.value = "";
    send.disabled = true;
    var t = el("asst-msg asst-bot typing", "…думаю");
    try {
      var r = await fetch(ASSISTANT_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      var data = await r.json();
      t.remove();
      if (data.error) {
        el("asst-msg asst-bot", "Помилка: " + data.error);
      } else {
        el("asst-msg asst-bot", data.answer);
        addSources(data.sources);
        addFeedback(data.log_id);
      }
    } catch (e) {
      t.remove();
      el(
        "asst-msg asst-bot",
        "Не вдалося звʼязатися з помічником. Перевірте, що бекенд задеплоєно і адреса ASSISTANT_API вказана правильно."
      );
    }
    send.disabled = false;
    input.focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    chat = document.getElementById("asst-chat");
    input = document.getElementById("asst-input");
    send = document.getElementById("asst-send");
    if (!chat || !send) return;

    send.addEventListener("click", ask);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ask();
      }
    });
    // Приветствие показываем при первом открытии вкладки «Помічник».
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      if (b.dataset.tab === "assistant") b.addEventListener("click", greet);
    });
  });
})();
