# SES Calculator — Power & Price Estimator / Калькулятор СЕС — потужність і ціна

[English](#english) | [Українська](#українська)

---

## English
file:///Users/escoreimac2escoreimac2/Claude/Projects/For%20Sales%20Department%20-%20Calculation%20of%20the%20Power%20and%20Price%20in%20the%20First%20Communication%20with%20Client/calculator_site_sales_department/index.html
A lightweight, static web tool that helps ESCORE sales managers give a client an instant, ballpark power and price estimate for a solar power station (SES) during the very first phone call — no engineer needed.

### What it does

The tool is organized into five tabs:

- **Калькулятор (Calculator)** — from a client's monthly electricity consumption (kWh), estimates daily / day / night consumption, target station power, the closest matching DEYE inverter, panel count, an indicative price, battery bank sizing for hybrid/autonomy setups, and mounting cost. Ends with a total price in USD and UAH.
- **Дані (Data)** — editable reference tables: inverter lineup, price-per-kW matrix (by station type / roof or ground / VAT / power), roof & mounting types, and the LV/HV battery catalogs. Edits are saved locally in the browser; Export/Import JSON lets you back up a data set or move it to another computer.
- **Розкладка панелей (Panel layout)** — search an address on a Google Map, trace the roof outline, and the tool auto-arranges the panel count computed on the Calculator tab (filling south-facing rows first, since they get the most sun). Save a clean, centered 2D PNG diagram to show the client.
- **Виробництво електроенергії (Energy production)** — estimated monthly/annual energy yield from the free PVGIS API (European Commission), using the same roof-tilt logic as the layout tool (snapped to the mounting angles actually available: 15° / 20° / 30°).
- **КП (Commercial proposal)** — generates a branded, printable commercial proposal (print → save as PDF) from the current calculation.

### Getting started

This is a static site: no build step, no server, no npm install.

1. Clone or download this repository.
2. Open `index.html` directly in a browser — it works straight from `file://`.

To share it with the whole team, host the folder anywhere that serves static files (GitHub Pages, any web host — see [Deployment](#deployment) below).

### Configuration

Two one-time setup values live at the top of `panels.js`:

- **`MAPS_API_KEY`** — a Google Maps JavaScript API key (Maps JavaScript API + Geocoding API enabled), used by the "Panel layout" and "Energy production" tabs for address search and the map. Step-by-step setup: `Налаштування_Google_Cloud.md`.
- **`PVGIS_PROXIES`** — PVGIS (the free EU solar-irradiation service) doesn't send CORS headers, so browser requests need a small proxy in front of it. The array currently lists a few free public CORS proxies tried in order as a fallback chain. For a more reliable setup, deploy your own free Cloudflare Worker (code and instructions included: `pvgis-proxy-worker.js`, `Налаштування_PVGIS_Proxy.md`) and put its URL first in the list.

Both "Panel layout" and "Energy production" also share a small **localStorage cache** of PVGIS responses (30-day TTL) — recalculating the same address is instant and doesn't touch the network at all.

### Data & storage

Reference data (prices, inverters, batteries, roof types) ships with sensible defaults in `data.js`. Anything edited on the "Дані" tab is saved only in that browser's `localStorage` — it does **not** sync automatically between devices or users. Use the Export/Import JSON buttons on the "Дані" tab to move a customized data set between machines.

### Deployment

To publish on GitHub Pages:

1. Push this repository to GitHub.
2. In the repo's **Settings → Pages**, set the source to the `main` branch, root folder.
3. Share the resulting `https://<org>.github.io/<repo>/` URL with the sales team.

### Project structure

| File | Purpose |
|---|---|
| `index.html` | Page shell and tab navigation |
| `style.css` | Styling |
| `data.js` | Default reference data (inverters, prices, roof types, batteries) |
| `calculator.js` | Pure calculation logic (power / price / battery sizing) |
| `storage.js` | localStorage persistence for edited reference data |
| `app.js` | "Калькулятор" tab wiring |
| `dani.js` | "Дані" tab (editable reference tables) |
| `geometry.js` | Panel-layout geometry (point-in-polygon, row sorting, tilt snapping) |
| `maps-loader.js` | Google Maps script loader |
| `panels.js` | "Розкладка панелей" tab + shared PVGIS fetch/cache helper |
| `production.js` | "Виробництво електроенергії" tab |
| `kp.js` | "КП" (commercial proposal) tab |
| `logo.js` | Base64-embedded company logo |
| `pvgis-proxy-worker.js` | Optional Cloudflare Worker source for a self-hosted PVGIS proxy |

### Company

Built for internal use by **ESCORE** — solar power station installer, Odesa, Ukraine.

---

## Українська

Легкий статичний веб-інструмент, який допомагає менеджерам відділу продажів ESCORE одразу, ще під час першого дзвінка клієнту, озвучити орієнтовну потужність і ціну сонячної станції (СЕС) — без залучення технічного фахівця.

### Що він робить

Інструмент складається з п'яти вкладок:

- **Калькулятор** — за місячним споживанням електроенергії клієнта (кВт·год) рахує добове/денне/нічне споживання, цільову потужність станції, найближчий за потужністю інвертор DEYE, кількість панелей, орієнтовну ціну, підбір комплекту АКБ для гібридних станцій з автономією, вартість кріплень і підсумкову ціну в $ та грн.
- **Дані** — редаговані довідкові таблиці: лінійка інверторів, матриця цін за кВт (залежно від типу станції / дах чи земля / ПДВ / потужності), типи даху й кріплень, каталоги акумуляторів LV/HV. Зміни зберігаються локально в браузері; кнопки Експорт/Імпорт JSON дозволяють зробити резервну копію або перенести дані на інший комп'ютер.
- **Розкладка панелей** — пошук адреси на Google-карті, обведення контуру даху, після чого інструмент автоматично розкладає кількість панелей, порахованих на вкладці «Калькулятор» (заповнюючи спочатку південні ряди — там найбільше сонця). Готову охайну 2D-картинку (PNG) можна зберегти й показати клієнту.
- **Виробництво електроенергії** — орієнтовне помісячне/річне вироблення електроенергії за даними безкоштовного сервісу PVGIS (Європейська комісія), з тим самим кутом нахилу кріплень, що й у розкладці панелей (округленим до реально доступних кутів: 15° / 20° / 30°).
- **КП** — автоматично формує брендовану комерційну пропозицію для друку (друк → зберегти як PDF) на основі поточного розрахунку.

### Швидкий старт

Це статичний сайт: без збірки, без сервера, без встановлення залежностей.

1. Склонуй або завантаж цей репозиторій.
2. Відкрий `index.html` прямо в браузері — працює навіть з `file://`, без веб-сервера.

Щоб дати доступ усій команді, розмісти папку на будь-якому статичному хостингу (GitHub Pages, будь-який веб-хостинг — див. розділ [Розгортання](#розгортання) нижче).

### Налаштування

Два одноразові параметри знаходяться на початку файлу `panels.js`:

- **`MAPS_API_KEY`** — ключ Google Maps JavaScript API (з увімкненими Maps JavaScript API + Geocoding API), потрібен вкладкам «Розкладка панелей» і «Виробництво електроенергії» для пошуку адреси й карти. Покрокова інструкція: `Налаштування_Google_Cloud.md`.
- **`PVGIS_PROXIES`** — сервіс PVGIS (безкоштовні дані інсоляції від ЄС) не віддає CORS-заголовки, тому запити з браузера потребують невеликого проксі-сервера. Зараз у списку — кілька безкоштовних публічних CORS-проксі, які пробуються по черзі як резервні варіанти. Для надійнішої роботи розгорни власний безкоштовний Cloudflare Worker (код і інструкція вже готові: `pvgis-proxy-worker.js`, `Налаштування_PVGIS_Proxy.md`) і впиши його адресу першим пунктом у список.

Вкладки «Розкладка панелей» і «Виробництво електроенергії» також мають спільний **кеш відповідей PVGIS** у localStorage (на 30 днів) — повторний розрахунок тієї самої адреси відбувається миттєво, без звернення до мережі.

### Дані та зберігання

Довідкові дані (ціни, інвертори, акумулятори, типи даху) постачаються з розумними початковими значеннями у файлі `data.js`. Усе, що відредаговано на вкладці «Дані», зберігається лише в `localStorage` конкретного браузера — це **не** синхронізується автоматично між пристроями чи користувачами. Кнопки Експорт/Імпорт JSON на вкладці «Дані» дозволяють перенести налаштований набір даних на інший комп'ютер.

### Розгортання

Щоб опублікувати на GitHub Pages:

1. Заливь цей репозиторій на GitHub.
2. У налаштуваннях репозиторію **Settings → Pages** вкажи джерело — гілка `main`, коренева папка.
3. Поділись отриманим посиланням `https://<org>.github.io/<repo>/` з відділом продажів.

### Структура проєкту

| Файл | Призначення |
|---|---|
| `index.html` | Каркас сторінки та навігація по вкладках |
| `style.css` | Стилі |
| `data.js` | Початкові довідкові дані (інвертори, ціни, типи даху, акумулятори) |
| `calculator.js` | Чиста логіка розрахунку (потужність / ціна / підбір АКБ) |
| `storage.js` | Збереження відредагованих довідкових даних у localStorage |
| `app.js` | Логіка вкладки «Калькулятор» |
| `dani.js` | Вкладка «Дані» (редаговані довідкові таблиці) |
| `geometry.js` | Геометрія розкладки панелей (точка-в-полігоні, сортування рядів, підгонка кута) |
| `maps-loader.js` | Завантажувач скрипта Google Maps |
| `panels.js` | Вкладка «Розкладка панелей» + спільна функція запиту/кешу PVGIS |
| `production.js` | Вкладка «Виробництво електроенергії» |
| `kp.js` | Вкладка «КП» (комерційна пропозиція) |
| `logo.js` | Логотип компанії, вбудований у base64 |
| `pvgis-proxy-worker.js` | Опційний код Cloudflare Worker для власного PVGIS-проксі |

### Компанія

Розроблено для внутрішнього використання компанією **ESCORE** — інсталятор сонячних станцій, Одеса.
