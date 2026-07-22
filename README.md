# SES Calculator — Power & Price Estimator / Калькулятор СЕС — потужність і ціна

[English](#english) | [Українська](#українська)

**Live tool:** https://ses-calculator.anna-escore.workers.dev/

---

## English

A lightweight, static web tool that helps ESCORE sales managers give a client an instant, ballpark power and price estimate for a solar power station (SES) during the very first phone call — no engineer needed.

### What it does

The tool is organized into five tabs:

- **Калькулятор (Calculator)** — has two calculation modes, chosen with a "Спосіб розрахунку" switch:
  - **За споживанням клієнта (By consumption)** — the default. From the client's monthly electricity consumption (kWh), estimates daily / day / night consumption, target station power, the closest matching inverter (SolaX Power for grid-tied, DEYE for hybrid), panel count, an indicative price, battery bank sizing for hybrid/autonomy setups, and mounting cost.
  - **За бажаним обладнанням клієнта (By requested equipment)** — for when the client already named the exact equipment they want. Inverter power is required; panel power and battery capacity are optional — leaving either blank means the client doesn't want that component, so it's fully excluded from the calculation and the price (not silently estimated). This mode adds a second switch, **Комплектація**: "З монтажем" (with installation — inverter + materials/labor + mounting, the default) or "Тільки обладнання" (equipment only — no materials/labor and no mounting cost, just the priced goods: inverter, panels, battery kit). When the inverter power is entered manually, the station price is computed **item-by-item** — actual inverter unit price + materials/labor cost for that power tier, both from the "Дані" tab — instead of the general $/kW estimate; if exact pricing for that combination isn't in "Дані" yet, it silently falls back to the $/kW estimate.
  - In both modes, hybrid stations needing more than the largest single DEYE unit (currently 50 kW) automatically **parallel multiple same-size units**, rounded up (e.g. 2×50 kW for a 100 kW target). Battery model and LV/HV bank are always picked automatically (best-fit by required capacity), but the **module count** can be corrected manually if a client explicitly doesn't want the built-in safety margin. Ends with a total price in USD and UAH.
- **Дані (Data)** — editable reference tables: inverter lineup **and per-unit prices** (with/without VAT — used for the item-by-item pricing above), the $/kW price matrix (by station type / roof or ground / VAT / power) **plus a materials-and-labor total for each power tier**, panel price per watt, roof & mounting types, and the LV/HV battery catalogs. Edits are saved locally in the browser; Export/Import JSON lets you back up a data set or move it to another computer.
- **Розкладка панелей (Panel layout)** — search an address on a Google Map, trace the roof outline, and the tool auto-arranges the panel count computed on the Calculator tab (filling south-facing rows first, since they get the most sun). Save a clean, centered 2D PNG diagram to show the client.
- **Виробництво електроенергії (Energy production)** — estimated monthly/annual energy yield from the free PVGIS API (European Commission), using the same roof-tilt logic as the layout tool (snapped to the mounting angles actually available: 15° / 20° / 30°).
- **КП (Commercial proposal)** — generates a branded, printable commercial proposal (print → save as PDF) from the current calculation.

### Getting started

This is a static site: no build step, no server, no npm install. Sales managers should just use the live link above — nothing to install.

For local development:

1. Clone or download this repository.
2. Open `index.html` directly in a browser — it works straight from `file://`.

### Configuration

Two one-time setup values live at the top of `panels.js`:

- **`MAPS_API_KEY`** — a Google Maps JavaScript API key (Maps JavaScript API + Geocoding API enabled), used by the "Panel layout" and "Energy production" tabs for address search and the map. Step-by-step setup: `Налаштування_Google_Cloud.md`.
- **`PVGIS_PROXIES`** — PVGIS (the free EU solar-irradiation service) doesn't send CORS headers, so browser requests need a small proxy in front of it. A dedicated Cloudflare Worker (`pvgis-proxy-worker.js`) is deployed and listed first; a few free public CORS proxies are kept after it as a fallback chain in case the dedicated Worker is ever down. Setup notes: `Налаштування_PVGIS_Proxy.md`.

Both "Panel layout" and "Energy production" also share a small **localStorage cache** of PVGIS responses (30-day TTL) — recalculating the same address is instant and doesn't touch the network at all.

### Data & storage

Reference data (prices, inverters, batteries, roof types, panel price) ships with sensible defaults in `data.js` — these are the numbers Anna maintains centrally. Anything edited on the "Дані" tab is saved only in that browser's `localStorage` and does **not** sync automatically between devices or users; if a manager's local edits get out of sync with the current prices, the "Скинути до початкових" (Reset) button on the "Дані" tab restores exactly what's shipped in `data.js`. Calculation constants (day/night split, panel wattage, markups, etc.) are never persisted from localStorage/import — they always come from the current code, so a code update always takes effect even for managers with old saved data.

### Deployment

Currently hosted as a Cloudflare Worker with static assets (free plan): https://ses-calculator.anna-escore.workers.dev/ — deployed via the Cloudflare dashboard (Workers & Pages → Create Application → direct upload of the site folder/zip), no Git connection required for redeploys. To publish an update, zip the folder and re-upload it to the same Worker project in the Cloudflare dashboard.

Alternatively, this repo can be published on GitHub Pages:

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

**Робоче посилання:** https://ses-calculator.anna-escore.workers.dev/

### Що він робить

Інструмент складається з п'яти вкладок:

- **Калькулятор** — має два способи розрахунку, які перемикаються вгорі перемикачем «Спосіб розрахунку»:
  - **За споживанням клієнта** — за замовчуванням. За місячним споживанням електроенергії клієнта (кВт·год) рахує добове/денне/нічне споживання, цільову потужність станції, найближчий за потужністю інвертор (SolaX Power для мережевих, DEYE для гібридних), кількість панелей, орієнтовну ціну, підбір комплекту АКБ для гібридних станцій з автономією, вартість кріплень і підсумкову ціну в $ та грн.
  - **За бажаним обладнанням клієнта** — коли клієнт уже сам назвав, яке обладнання хоче. Потужність інвертора — обов'язкове поле; потужність панелей і ємність АКБ — за бажанням: порожнє поле в цьому режимі означає «клієнт не хоче цей компонент» — він повністю виключається з розрахунку й ціни, а не підставляється автоматично. У цьому режимі з'являється друга розвилка — **Комплектація**: «З монтажем» (інвертор + матеріали/роботи + кріплення, за замовчуванням) або «Тільки обладнання» (без матеріалів/робіт монтажу і без кріплень — рахуються тільки самі товари: інвертор за прайсом, панелі за $/Вт, комплект АКБ). Якщо потужність інвертора введена вручну, ціна станції рахується **поелементно** — реальна ціна конкретного інвертора + матеріали й роботи для цієї потужності, обидва з вкладки «Дані» — замість орієнтовної ціни $/кВт; якщо точних даних для цієї комбінації в «Дані» ще немає, розрахунок тихо повертається до орієнтовної ціни $/кВт.
  - В обох режимах для гібридних станцій, яким потрібно більше за найбільший окремий блок DEYE (зараз 50 кВт), автоматично береться **паралель кількох однакових блоків** з округленням вгору (наприклад, 2×50 кВт для цілі 100 кВт). Модель АКБ і система LV/HV завжди підбираються автоматично (найкраще заповнення під потрібну ємність), але **кількість модулів** можна скоригувати вручну, якщо клієнт свідомо не хоче стандартного запасу.
- **Дані** — редаговані довідкові таблиці: лінійка інверторів **і ціни за штуку** (з ПДВ і без — для поелементного розрахунку вище), матриця цін за кВт (залежно від типу станції / дах чи земля / ПДВ / потужності) **плюс сума матеріалів і робіт для кожної потужності**, ціна панелі за Вт, типи даху й кріплень, каталоги акумуляторів LV/HV. Зміни зберігаються локально в браузері; кнопки Експорт/Імпорт JSON дозволяють зробити резервну копію або перенести дані на інший комп'ютер.
- **Розкладка панелей** — пошук адреси на Google-карті, обведення контуру даху, після чого інструмент автоматично розкладає кількість панелей, порахованих на вкладці «Калькулятор» (заповнюючи спочатку південні ряди — там найбільше сонця). Готову охайну 2D-картинку (PNG) можна зберегти й показати клієнту.
- **Виробництво електроенергії** — орієнтовне помісячне/річне вироблення електроенергії за даними безкоштовного сервісу PVGIS (Європейська комісія), з тим самим кутом нахилу кріплень, що й у розкладці панелей (округленим до реально доступних кутів: 15° / 20° / 30°).
- **КП** — автоматично формує брендовану комерційну пропозицію для друку (друк → зберегти як PDF) на основі поточного розрахунку.

### Швидкий старт

Це статичний сайт: без збірки, без сервера, без встановлення залежностей. Менеджерам достатньо робочого посилання вище — нічого встановлювати не треба.

Для локальної розробки:

1. Склонуй або завантаж цей репозиторій.
2. Відкрий `index.html` прямо в браузері — працює навіть з `file://`, без веб-сервера.

### Налаштування

Два одноразові параметри знаходяться на початку файлу `panels.js`:

- **`MAPS_API_KEY`** — ключ Google Maps JavaScript API (з увімкненими Maps JavaScript API + Geocoding API), потрібен вкладкам «Розкладка панелей» і «Виробництво електроенергії» для пошуку адреси й карти. Покрокова інструкція: `Налаштування_Google_Cloud.md`.
- **`PVGIS_PROXIES`** — сервіс PVGIS (безкоштовні дані інсоляції від ЄС) не віддає CORS-заголовки, тому запити з браузера потребують невеликого проксі-сервера. Власний Cloudflare Worker (`pvgis-proxy-worker.js`) уже розгорнутий і стоїть першим у списку; кілька безкоштовних публічних CORS-проксі лишені після нього як запасні на випадок, якщо власний воркер ляже. Деталі: `Налаштування_PVGIS_Proxy.md`.

Вкладки «Розкладка панелей» і «Виробництво електроенергії» також мають спільний **кеш відповідей PVGIS** у localStorage (на 30 днів) — повторний розрахунок тієї самої адреси відбувається миттєво, без звернення до мережі.

### Дані та зберігання

Довідкові дані (ціни, інвертори, акумулятори, типи даху, ціна панелей) постачаються з актуальними значеннями у файлі `data.js` — це ті цифри, які централізовано підтримує Anna. Усе, що відредаговано на вкладці «Дані», зберігається лише в `localStorage` конкретного браузера й **не** синхронізується автоматично між пристроями чи користувачами; якщо в когось локальні правки розійшлися з актуальними цінами — кнопка «Скинути до початкових» на вкладці «Дані» повертає рівно те, що зашито в `data.js`. Константи розрахунку (частка дня/ночі, потужність панелі, націнки тощо) із localStorage/імпорту НІКОЛИ не підтягуються — вони завжди беруться з поточного коду, тому оновлення коду діє одразу навіть для тих, у кого лишились старі збережені дані.

### Розгортання

Зараз сайт розміщено як Cloudflare Worker зі статичними файлами (безкоштовний план): https://ses-calculator.anna-escore.workers.dev/ — розгорнуто через панель Cloudflare (Workers & Pages → Create Application → пряме завантаження папки сайту/zip-архіву), Git для оновлень не потрібен. Щоб опублікувати оновлення — зібрати папку в zip і перезалити його в той самий проєкт Worker у панелі Cloudflare.

Альтернативно цей репозиторій можна опублікувати на GitHub Pages:

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
