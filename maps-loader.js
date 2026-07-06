// maps-loader.js — спільне завантаження Google Maps JavaScript API для
// «Розкладки панелей» і «Виробництва електроенергії», щоб скрипт не
// підключався двічі, якщо менеджер відкриє обидві вкладки.

const SesMapsLoader = (function () {
  let state = "idle"; // idle | loading | ready | error
  let queue = [];

  function ensure(apiKey, onReady) {
    if (state === "ready") {
      onReady();
      return;
    }
    queue.push(onReady);
    if (state === "loading") return;
    state = "loading";

    window.__sesMapsReady = function () {
      state = "ready";
      const cbs = queue;
      queue = [];
      cbs.forEach((fn) => fn());
    };
    window.gm_authFailure = function () {
      state = "error";
      document.dispatchEvent(new CustomEvent("ses:maps-auth-failure"));
    };

    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(apiKey) +
      "&v=weekly&callback=__sesMapsReady";
    document.head.appendChild(s);
  }

  return { ensure };
})();
