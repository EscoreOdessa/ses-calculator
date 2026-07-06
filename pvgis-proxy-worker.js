// pvgis-proxy-worker.js — маленький проксі-сервер для обходу CORS-обмеження
// сервісу PVGIS (він не дозволяє звертатись до себе напряму з браузера).
// Розгортається на Cloudflare Workers (безкоштовно) — див.
// «Налаштування_PVGIS_Proxy.md» в цій самій папці.
//
// Приймає лише запити до re.jrc.ec.europa.eu (PVGIS), інші URL відхиляє.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (!target || !target.startsWith("https://re.jrc.ec.europa.eu/")) {
      return new Response("Bad request: missing or disallowed ?url=", { status: 400, headers: cors });
    }

    try {
      const resp = await fetch(target);
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { "Content-Type": "application/json", ...cors },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  },
};
