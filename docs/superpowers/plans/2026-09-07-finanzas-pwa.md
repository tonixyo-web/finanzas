# Finanzas PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable iOS-styled personal finance PWA (accounts, transactions, transfers, automatic Trade Republic interest, recurring entries, category charts) that stores data in localStorage and deploys to GitHub Pages.

**Architecture:** Plain HTML/CSS/JavaScript ES modules with no build step. A single JSON state object lives in localStorage behind a tiny store (`getState / update / subscribe`). All money math lives in pure functions (`model.js`) tested in the browser. Views are functions that rebuild their DOM from state on every change; charts are hand-drawn SVG.

**Tech Stack:** HTML5, CSS custom properties, JavaScript ES2022 modules, SVG, localStorage, Web App Manifest + Service Worker. Tests run in headless Microsoft Edge (no Node on this machine).

**Spec:** `docs/superpowers/specs/2026-09-07-finanzas-pwa-design.md`

## Global Constraints

- No Node, no npm, no bundler, no framework, no external CDN. Everything ships as static files.
- All amounts are **integer cents**. Dates are `YYYY-MM-DD` strings; months are `YYYY-MM` strings (string comparison is chronological).
- UI language is Spanish (castellano). Currency format: `1.234,56 €` with a non‑breaking space (`\u00a0`) before `€`, minus sign as `-`.
- Every path in HTML/JS/SW is **relative** (`./...`) so the app works under `https://<user>.github.io/<repo>/`.
- Light and dark themes follow the system (`prefers-color-scheme`). iOS safe areas are respected with `env(safe-area-inset-*)`.
- Category ids for system categories are fixed strings: `cat-interest`, `cat-salary`, `cat-other`.
- Tests: open `tests/tests.html` in a browser, or run `bash tests/run-tests.sh` (headless Edge). A passing run prints `TESTS: N passed, 0 failed`.
- Commit after every task. Git identity is configured locally in Task 1. Branch is `main`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL
  ```

## File map

| File | Responsibility |
|---|---|
| `index.html` | Shell: `<main id="view">`, tab bar, script/module entry |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA install + offline cache |
| `css/base.css` | Design tokens (light/dark), reset, typography, layout primitives |
| `css/components.css` | Cards, rows, segmented control, sheet, tab bar, FAB, chips, charts styling |
| `js/format.js` | Money/date formatting and month arithmetic (pure) |
| `js/model.js` | Balances, monthly summaries, series, interest/recurring posting, validation (pure) |
| `js/store.js` | Default state, load/save/migrate, `createStore`, automatic posting, export/import parsing |
| `js/actions.js` | State mutations (add/update/delete transactions, accounts, categories, recurring, valuations) |
| `js/ui.js` | DOM helper `h`, bottom sheet, toast, month picker, swipe row, form fields |
| `js/charts.js` | SVG ring, donut, bar and line charts |
| `js/app.js` | Boot: store, automatic posting, tab routing, re-render on change, SW registration |
| `js/views/home.js` | Net worth, three rings, account cards, FAB |
| `js/views/transactions.js` | Month picker + grouped list + swipe delete |
| `js/views/stats.js` | Donut + legend, 12‑month bars, net worth line, category detail |
| `js/views/settings.js` | Accounts / categories / recurring management, backup export/import |
| `js/views/sheet-transaction.js` | Add/edit transaction sheet |
| `js/views/sheet-valuation.js` | Update manual valuation sheet |
| `js/views/settings-sheets.js` | Account / category / recurring edit sheets |
| `tests/runner.js`, `tests/tests.html`, `tests/run-tests.sh`, `tests/smoke.sh` | Browser test runner + headless commands |
| `tests/*.test.js` | Unit tests for `format`, `model`, `store`, `actions` |
| `tools/make-icons.ps1` | Generates PNG icons with PowerShell/System.Drawing |
| `README.md` | Deploy to GitHub Pages + install on iPhone |

---

### Task 1: Scaffold, test runner and `format.js`

**Files:**
- Create: `tests/runner.js`, `tests/tests.html`, `tests/run-tests.sh`, `tests/format.test.js`, `js/format.js`, `.gitignore`

**Interfaces:**
- Produces (`tests/runner.js`): `test(name, fn)`, `assertEqual(actual, expected, msg?)`, `assertTrue(cond, msg?)`, `assertThrows(fn, msg?)`, `runAll(): Promise<{name, ok, error?}[]>`
- Produces (`js/format.js`): `pad2(n)`, `todayStr(date?)`, `monthKey(dateStr)`, `addMonths(ym, n)`, `lastDayOfMonth(ym)`, `monthRange(endYm, n)`, `monthLabel(ym)`, `shortMonthLabel(ym)`, `dayLabel(dateStr, today?)`, `capitalize(s)`, `formatMoney(cents, {sign?})`, `parseAmount(str)`

- [ ] **Step 1: Configure git identity and branch**

```bash
cd "C:/Users/tonix/Desktop/app_banco"
git config user.name "tonix"
git config user.email "sistemasgastraval@gmail.com"
git branch -M main
printf '.DS_Store\nThumbs.db\n' > .gitignore
```

- [ ] **Step 2: Write the test runner**

`tests/runner.js`:
```js
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} esperado ${e}, obtenido ${a}`.trim());
}

export function assertTrue(cond, msg = "condición falsa") {
  if (!cond) throw new Error(msg);
}

export function assertThrows(fn, msg = "se esperaba una excepción") {
  try { fn(); } catch { return; }
  throw new Error(msg);
}

export async function runAll() {
  const results = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
    } catch (err) {
      results.push({ name: t.name, ok: false, error: err.message });
    }
  }
  return results;
}
```

`tests/tests.html`:
```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Tests Finanzas</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; }
  .ok { color: #1a7f37; } .fail { color: #d1242f; }
  li { margin: 4px 0; }
</style>
</head>
<body>
<h1>Tests</h1>
<pre id="summary">pending</pre>
<ul id="list"></ul>
<script type="module">
import { runAll } from "./runner.js";
import "./format.test.js";

const results = await runAll();
const list = document.getElementById("list");
for (const r of results) {
  const li = document.createElement("li");
  li.className = r.ok ? "ok" : "fail";
  li.textContent = (r.ok ? "OK: " : "FAIL: ") + r.name + (r.ok ? "" : " — " + r.error);
  list.appendChild(li);
}
const failed = results.filter(r => !r.ok).length;
document.getElementById("summary").textContent =
  `TESTS: ${results.length - failed} passed, ${failed} failed`;
</script>
</body>
</html>
```

`tests/run-tests.sh`:
```bash
#!/usr/bin/env bash
# Runs tests/tests.html in headless Edge and prints the summary and failures.
EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
"$EDGE" --headless=new --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=5000 --dump-dom "file:///$DIR/tests.html" 2>/dev/null \
  | grep -oE '(TESTS|FAIL): [^<]*'
```

- [ ] **Step 3: Write failing tests for `format.js`**

`tests/format.test.js`:
```js
import { test, assertEqual } from "./runner.js";
import {
  pad2, todayStr, monthKey, addMonths, lastDayOfMonth, monthRange,
  monthLabel, shortMonthLabel, dayLabel, capitalize, formatMoney, parseAmount
} from "../js/format.js";

test("pad2 rellena con cero", () => {
  assertEqual(pad2(3), "03");
  assertEqual(pad2(12), "12");
});

test("todayStr usa la fecha local", () => {
  assertEqual(todayStr(new Date(2026, 8, 7)), "2026-09-07");
});

test("monthKey recorta a YYYY-MM", () => {
  assertEqual(monthKey("2026-09-07"), "2026-09");
});

test("addMonths cruza años en ambos sentidos", () => {
  assertEqual(addMonths("2026-12", 1), "2027-01");
  assertEqual(addMonths("2026-01", -1), "2025-12");
  assertEqual(addMonths("2026-03", 0), "2026-03");
});

test("lastDayOfMonth respeta bisiestos", () => {
  assertEqual(lastDayOfMonth("2024-02"), "2024-02-29");
  assertEqual(lastDayOfMonth("2026-09"), "2026-09-30");
});

test("monthRange devuelve n meses terminando en endYm", () => {
  assertEqual(monthRange("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
});

test("monthLabel y shortMonthLabel en castellano", () => {
  assertEqual(monthLabel("2026-09"), "septiembre 2026");
  assertEqual(shortMonthLabel("2026-01"), "ene");
  assertEqual(capitalize("septiembre 2026"), "Septiembre 2026");
});

test("dayLabel devuelve Hoy, Ayer o día con nombre", () => {
  assertEqual(dayLabel("2026-09-07", "2026-09-07"), "Hoy");
  assertEqual(dayLabel("2026-09-06", "2026-09-07"), "Ayer");
  assertEqual(dayLabel("2026-09-01", "2026-09-07"), "Martes 1 de septiembre");
});

test("formatMoney con miles, decimales y signo", () => {
  assertEqual(formatMoney(123456), "1.234,56\u00a0€");
  assertEqual(formatMoney(5), "0,05\u00a0€");
  assertEqual(formatMoney(-250000), "-2.500,00\u00a0€");
  assertEqual(formatMoney(1000, { sign: true }), "+10,00\u00a0€");
  assertEqual(formatMoney(0, { sign: true }), "0,00\u00a0€");
  assertEqual(formatMoney(123456789), "1.234.567,89\u00a0€");
});

test("parseAmount acepta coma, punto y miles", () => {
  assertEqual(parseAmount("12,5"), 1250);
  assertEqual(parseAmount("12.5"), 1250);
  assertEqual(parseAmount("1.234,56"), 123456);
  assertEqual(parseAmount("1234"), 123400);
  assertEqual(parseAmount(" 7 "), 700);
  assertEqual(parseAmount(""), null);
  assertEqual(parseAmount("abc"), null);
  assertEqual(parseAmount("1,234"), null);
  assertEqual(parseAmount(null), null);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bash tests/run-tests.sh`
Expected: no `TESTS:` line (module import of `../js/format.js` fails), or `TESTS: 0 passed, 0 failed`. Either counts as failing.

- [ ] **Step 5: Implement `js/format.js`**

```js
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function splitYm(ym) {
  const [y, m] = ym.split("-").map(Number);
  return { y, m };
}

export function addMonths(ym, n) {
  const { y, m } = splitYm(ym);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

export function lastDayOfMonth(ym) {
  const { y, m } = splitYm(ym);
  return `${ym}-${pad2(new Date(y, m, 0).getDate())}`;
}

export function monthRange(endYm, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(endYm, -i));
  return out;
}

export function monthLabel(ym) {
  const { y, m } = splitYm(ym);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shortMonthLabel(ym) {
  return MONTHS_SHORT[splitYm(ym).m - 1];
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function dayLabel(dateStr, today = todayStr()) {
  if (dateStr === today) return "Hoy";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const yesterday = new Date(dt); yesterday.setDate(d + 1);
  if (todayStr(yesterday) === today) return "Ayer";
  return `${capitalize(DAYS[dt.getDay()])} ${d} de ${MONTHS[m - 1]}`;
}

export function formatMoney(cents, { sign = false } = {}) {
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  const int = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = pad2(abs % 100);
  const prefix = rounded < 0 ? "-" : (sign && rounded > 0 ? "+" : "");
  return `${prefix}${int},${dec}\u00a0€`;
}

export function parseAmount(str) {
  if (typeof str !== "string") return null;
  let clean = str.trim();
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bash tests/run-tests.sh`
Expected: `TESTS: 10 passed, 0 failed`

- [ ] **Step 7: Commit**

```bash
git add .gitignore tests js
git commit -m "feat: test runner y utilidades de formato

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 2: `model.js` — balances, summaries and series

**Files:**
- Create: `js/model.js`, `tests/model.test.js`
- Modify: `tests/tests.html` (add `import "./model.test.js";` after the format import)

**Interfaces:**
- Consumes: `monthKey, addMonths, lastDayOfMonth, monthRange` from `js/format.js`
- Produces: `CAT_INTEREST = "cat-interest"`, `CAT_SALARY = "cat-salary"`, `CAT_OTHER = "cat-other"`, `SAVING_KINDS` (Set), `accountBalance(state, accountId, untilDate?) → cents`, `netWorth(state, untilDate?) → cents`, `monthSummary(state, ym) → {income, expense, savings}`, `expensesByCategory(state, ym) → [{categoryId, amount}]` sorted desc, `monthSeries(state, endYm, n=12) → [{ym, income, expense, savings}]`, `firstDataMonth(state) → ym|null`, `netWorthSeries(state, endYm) → [{ym, value}]`, `categorySeries(state, categoryId, endYm, n=12) → [{ym, amount}]`

State shape used by every test (matches spec §4):
```js
state = { accounts: [{id, name, kind, valuation, initialBalance, annualRate, ...}], valuations: [{id, accountId, date, value}], categories: [...], transactions: [{id, type, amount, date, accountId, toAccountId?, categoryId?, source}], recurring: [...], meta: { interestLastPosted: {} } }
```

Balance rule for `valuation: "manual"` accounts (refines spec §5): balance = value of the latest valuation with `date <= untilDate` **plus** net transfers dated strictly after that valuation (or all transfers if there is no valuation). This way transferring money to Bitcoin shows up immediately, and the next valuation resets the base.

- [ ] **Step 1: Write failing tests**

`tests/model.test.js`:
```js
import { test, assertEqual } from "./runner.js";
import {
  accountBalance, netWorth, monthSummary, expensesByCategory,
  monthSeries, firstDataMonth, netWorthSeries, categorySeries
} from "../js/model.js";

function acc(id, kind, valuation = "ledger", extra = {}) {
  return { id, name: id, kind, valuation, initialBalance: 0, annualRate: 0, color: "#000", icon: "x", order: 0, ...extra };
}
function tx(o) {
  return { id: o.id || Math.random().toString(36), note: "", source: "manual", ...o };
}
function baseState() {
  return {
    schemaVersion: 1,
    accounts: [
      acc("bank", "bank", "ledger", { initialBalance: 10000 }),
      acc("sav", "savings"),
      acc("tr", "savings", "ledger", { annualRate: 2 }),
      acc("btc", "crypto", "manual"),
    ],
    valuations: [],
    categories: [{ id: "c1", name: "Ocio" }, { id: "c2", name: "Comida" }],
    transactions: [],
    recurring: [],
    meta: { interestLastPosted: {} },
  };
}

test("accountBalance ledger suma ingresos, resta gastos y transferencias", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "income", amount: 5000, date: "2026-09-01", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 1500, date: "2026-09-02", accountId: "bank", categoryId: "c1" }),
    tx({ type: "transfer", amount: 2000, date: "2026-09-03", accountId: "bank", toAccountId: "sav" }),
  ];
  assertEqual(accountBalance(s, "bank"), 10000 + 5000 - 1500 - 2000);
  assertEqual(accountBalance(s, "sav"), 2000);
});

test("accountBalance respeta la fecha límite", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "income", amount: 5000, date: "2026-09-01", accountId: "bank", categoryId: "c1" }),
    tx({ type: "income", amount: 700, date: "2026-10-01", accountId: "bank", categoryId: "c1" }),
  ];
  assertEqual(accountBalance(s, "bank", "2026-09-30"), 15000);
  assertEqual(accountBalance(s, "bank"), 15700);
});

test("accountBalance manual usa la última valoración más transferencias posteriores", () => {
  const s = baseState();
  s.valuations = [
    { id: "v1", accountId: "btc", date: "2026-08-01", value: 100000 },
    { id: "v2", accountId: "btc", date: "2026-09-01", value: 120000 },
  ];
  s.transactions = [
    tx({ type: "transfer", amount: 5000, date: "2026-08-15", accountId: "bank", toAccountId: "btc" }),
    tx({ type: "transfer", amount: 3000, date: "2026-09-10", accountId: "bank", toAccountId: "btc" }),
  ];
  assertEqual(accountBalance(s, "btc", "2026-08-20"), 105000);
  assertEqual(accountBalance(s, "btc", "2026-09-01"), 120000);
  assertEqual(accountBalance(s, "btc"), 123000);
});

test("accountBalance manual sin valoración es la suma de transferencias", () => {
  const s = baseState();
  s.transactions = [tx({ type: "transfer", amount: 4000, date: "2026-09-10", accountId: "bank", toAccountId: "btc" })];
  assertEqual(accountBalance(s, "btc"), 4000);
  assertEqual(accountBalance(s, "desconocida"), 0);
});

test("netWorth suma todas las cuentas", () => {
  const s = baseState();
  s.valuations = [{ id: "v1", accountId: "btc", date: "2026-09-01", value: 50000 }];
  s.transactions = [tx({ type: "transfer", amount: 2000, date: "2026-09-03", accountId: "bank", toAccountId: "sav" })];
  assertEqual(netWorth(s), 10000 + 50000);
});

test("monthSummary calcula ingresos, gastos y ahorro neto del mes", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "income", amount: 180000, date: "2026-09-01", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 3000, date: "2026-09-02", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 2000, date: "2026-09-05", accountId: "bank", categoryId: "c2" }),
    tx({ type: "transfer", amount: 50000, date: "2026-09-03", accountId: "bank", toAccountId: "tr" }),
    tx({ type: "transfer", amount: 10000, date: "2026-09-04", accountId: "tr", toAccountId: "bank" }),
    tx({ type: "transfer", amount: 7000, date: "2026-09-06", accountId: "sav", toAccountId: "tr" }),
    tx({ type: "expense", amount: 999, date: "2026-08-31", accountId: "bank", categoryId: "c1" }),
  ];
  assertEqual(monthSummary(s, "2026-09"), { income: 180000, expense: 5000, savings: 40000 });
  assertEqual(monthSummary(s, "2026-07"), { income: 0, expense: 0, savings: 0 });
});

test("expensesByCategory agrupa y ordena descendente", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "expense", amount: 1000, date: "2026-09-02", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 2500, date: "2026-09-05", accountId: "bank", categoryId: "c2" }),
    tx({ type: "expense", amount: 500, date: "2026-09-09", accountId: "bank", categoryId: "c1" }),
    tx({ type: "income", amount: 500, date: "2026-09-09", accountId: "bank", categoryId: "c1" }),
  ];
  assertEqual(expensesByCategory(s, "2026-09"), [
    { categoryId: "c2", amount: 2500 },
    { categoryId: "c1", amount: 1500 },
  ]);
});

test("monthSeries devuelve n meses con ceros donde no hay datos", () => {
  const s = baseState();
  s.transactions = [tx({ type: "expense", amount: 100, date: "2026-09-02", accountId: "bank", categoryId: "c1" })];
  const series = monthSeries(s, "2026-09", 3);
  assertEqual(series.map(x => x.ym), ["2026-07", "2026-08", "2026-09"]);
  assertEqual(series[0], { ym: "2026-07", income: 0, expense: 0, savings: 0 });
  assertEqual(series[2].expense, 100);
});

test("firstDataMonth mira movimientos y valoraciones", () => {
  const s = baseState();
  assertEqual(firstDataMonth(s), null);
  s.valuations = [{ id: "v", accountId: "btc", date: "2026-03-10", value: 1 }];
  s.transactions = [tx({ type: "expense", amount: 1, date: "2026-05-01", accountId: "bank", categoryId: "c1" })];
  assertEqual(firstDataMonth(s), "2026-03");
});

test("netWorthSeries va desde el primer mes con datos hasta endYm", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "income", amount: 1000, date: "2026-07-15", accountId: "bank", categoryId: "c1" }),
    tx({ type: "income", amount: 1000, date: "2026-09-15", accountId: "bank", categoryId: "c1" }),
  ];
  assertEqual(netWorthSeries(s, "2026-09"), [
    { ym: "2026-07", value: 11000 },
    { ym: "2026-08", value: 11000 },
    { ym: "2026-09", value: 12000 },
  ]);
});

test("netWorthSeries sin datos devuelve solo endYm", () => {
  assertEqual(netWorthSeries(baseState(), "2026-09"), [{ ym: "2026-09", value: 10000 }]);
});

test("categorySeries suma gastos de una categoría por mes", () => {
  const s = baseState();
  s.transactions = [
    tx({ type: "expense", amount: 300, date: "2026-08-02", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 200, date: "2026-09-02", accountId: "bank", categoryId: "c1" }),
    tx({ type: "expense", amount: 900, date: "2026-09-02", accountId: "bank", categoryId: "c2" }),
  ];
  assertEqual(categorySeries(s, "c1", "2026-09", 3), [
    { ym: "2026-07", amount: 0 }, { ym: "2026-08", amount: 300 }, { ym: "2026-09", amount: 200 },
  ]);
});
```

Add to `tests/tests.html` right after `import "./format.test.js";`:
```js
import "./model.test.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bash tests/run-tests.sh`
Expected: no `TESTS:` line (import of `../js/model.js` fails).

- [ ] **Step 3: Implement `js/model.js`**

```js
import { monthKey, addMonths, lastDayOfMonth, monthRange } from "./format.js";

export const CAT_INTEREST = "cat-interest";
export const CAT_SALARY = "cat-salary";
export const CAT_OTHER = "cat-other";
export const SAVING_KINDS = new Set(["savings", "investment", "crypto"]);

const MAX_DATE = "9999-12-31";

function findAccount(state, id) {
  return state.accounts.find(a => a.id === id);
}

function netTransfers(state, accountId, fromDateExclusive, untilDate) {
  let net = 0;
  for (const t of state.transactions) {
    if (t.type !== "transfer" || t.date > untilDate || t.date <= fromDateExclusive) continue;
    if (t.accountId === accountId) net -= t.amount;
    if (t.toAccountId === accountId) net += t.amount;
  }
  return net;
}

export function accountBalance(state, accountId, untilDate = MAX_DATE) {
  const acc = findAccount(state, accountId);
  if (!acc) return 0;
  if (acc.valuation === "manual") {
    let best = null;
    for (const v of state.valuations) {
      if (v.accountId === accountId && v.date <= untilDate && (!best || v.date >= best.date)) best = v;
    }
    const base = best ? best.value : 0;
    return base + netTransfers(state, accountId, best ? best.date : "", untilDate);
  }
  let bal = acc.initialBalance || 0;
  for (const t of state.transactions) {
    if (t.date > untilDate) continue;
    if (t.type === "income" && t.accountId === accountId) bal += t.amount;
    else if (t.type === "expense" && t.accountId === accountId) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.accountId === accountId) bal -= t.amount;
      if (t.toAccountId === accountId) bal += t.amount;
    }
  }
  return bal;
}

export function netWorth(state, untilDate = MAX_DATE) {
  return state.accounts.reduce((sum, a) => sum + accountBalance(state, a.id, untilDate), 0);
}

export function monthSummary(state, ym) {
  const kindOf = id => findAccount(state, id)?.kind;
  let income = 0, expense = 0, savings = 0;
  for (const t of state.transactions) {
    if (monthKey(t.date) !== ym) continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
    else if (t.type === "transfer") {
      const from = kindOf(t.accountId), to = kindOf(t.toAccountId);
      if (from === "bank" && SAVING_KINDS.has(to)) savings += t.amount;
      else if (SAVING_KINDS.has(from) && to === "bank") savings -= t.amount;
    }
  }
  return { income, expense, savings };
}

export function expensesByCategory(state, ym) {
  const totals = new Map();
  for (const t of state.transactions) {
    if (t.type !== "expense" || monthKey(t.date) !== ym) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount);
  }
  return [...totals].map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function monthSeries(state, endYm, n = 12) {
  return monthRange(endYm, n).map(ym => ({ ym, ...monthSummary(state, ym) }));
}

export function firstDataMonth(state) {
  let min = null;
  for (const t of state.transactions) if (!min || t.date < min) min = t.date;
  for (const v of state.valuations) if (!min || v.date < min) min = v.date;
  return min ? monthKey(min) : null;
}

export function netWorthSeries(state, endYm) {
  const first = firstDataMonth(state);
  const start = first && first < endYm ? first : endYm;
  const out = [];
  for (let ym = start; ym <= endYm; ym = addMonths(ym, 1)) {
    out.push({ ym, value: netWorth(state, lastDayOfMonth(ym)) });
  }
  return out;
}

export function categorySeries(state, categoryId, endYm, n = 12) {
  return monthRange(endYm, n).map(ym => ({
    ym,
    amount: state.transactions
      .filter(t => t.type === "expense" && t.categoryId === categoryId && monthKey(t.date) === ym)
      .reduce((sum, t) => sum + t.amount, 0),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bash tests/run-tests.sh`
Expected: `TESTS: 22 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add js/model.js tests
git commit -m "feat: cálculos de saldos, resúmenes y series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 3: `model.js` — automatic interest, recurring posting and validation

**Files:**
- Modify: `js/model.js` (append), `tests/model.test.js` (append)

**Interfaces:**
- Produces: `pendingInterest(state, today, makeId) → {transactions, interestLastPosted}`, `pendingRecurring(state, today, makeId) → {transactions, recurring}`, `initialLastPosted(dayOfMonth, today) → ym`, `validateTransaction(tx) → string[]`, `accountInUse(state, accountId) → bool`, `categoryUsageCount(state, categoryId) → number`

Rules (spec §5):
- Interest: for each ledger account with `annualRate > 0`, for each month `M` after `meta.interestLastPosted[acc.id]` up to and including the current month: `amount = round(balance at last day of month before M × annualRate / 100 / 12)`. Balance includes interest generated for earlier months in the same run (compound). Amount 0 → no transaction, but `interestLastPosted` still advances. An account with no entry in `interestLastPosted` gets the current month and no arrears.
- Recurring: for each active recurring, for each month after `lastPosted` up to the current month, post on `dayOfMonth` if that date is `<= today`; stop at the first future date.
- `initialLastPosted(day, today)`: current month if `day <= today's day`, else previous month.

- [ ] **Step 1: Append failing tests to `tests/model.test.js`**

```js
import {
  pendingInterest, pendingRecurring, initialLastPosted, validateTransaction,
  accountInUse, categoryUsageCount, CAT_INTEREST
} from "../js/model.js";

let idCounter = 0;
const makeId = () => `id-${++idCounter}`;

test("pendingInterest genera un ingreso por mes pendiente con interés compuesto", () => {
  const s = baseState();
  s.accounts.find(a => a.id === "tr").annualRate = 12; // 1 % al mes
  s.transactions = [tx({ type: "transfer", amount: 100000, date: "2026-06-10", accountId: "bank", toAccountId: "tr" })];
  s.meta.interestLastPosted = { tr: "2026-06" };
  const r = pendingInterest(s, "2026-08-15", makeId);
  assertEqual(r.transactions.length, 2);
  assertEqual(r.transactions[0].date, "2026-07-01");
  assertEqual(r.transactions[0].amount, 1000);
  assertEqual(r.transactions[0].categoryId, CAT_INTEREST);
  assertEqual(r.transactions[0].source, "interest");
  assertEqual(r.transactions[0].accountId, "tr");
  assertEqual(r.transactions[1].date, "2026-08-01");
  assertEqual(r.transactions[1].amount, 1010);
  assertEqual(r.interestLastPosted, { tr: "2026-08" });
});

test("pendingInterest no hace nada si ya está al día o el saldo es cero", () => {
  const s = baseState();
  s.meta.interestLastPosted = { tr: "2026-09" };
  assertEqual(pendingInterest(s, "2026-09-20", makeId).transactions, []);
  s.meta.interestLastPosted = { tr: "2026-07" };
  const r = pendingInterest(s, "2026-09-20", makeId);
  assertEqual(r.transactions, []);
  assertEqual(r.interestLastPosted, { tr: "2026-09" });
});

test("pendingInterest fija el mes actual a cuentas nuevas sin atrasos", () => {
  const s = baseState();
  s.transactions = [tx({ type: "transfer", amount: 100000, date: "2026-01-10", accountId: "bank", toAccountId: "tr" })];
  s.meta.interestLastPosted = {};
  const r = pendingInterest(s, "2026-09-20", makeId);
  assertEqual(r.transactions, []);
  assertEqual(r.interestLastPosted, { tr: "2026-09" });
});

test("pendingRecurring registra los meses pendientes cuyo día ya llegó", () => {
  const s = baseState();
  s.recurring = [
    { id: "r1", type: "expense", amount: 60000, accountId: "bank", categoryId: "c1", note: "Alquiler", dayOfMonth: 1, active: true, lastPosted: "2026-06" },
    { id: "r2", type: "income", amount: 180000, accountId: "bank", categoryId: "c2", note: "", dayOfMonth: 28, active: true, lastPosted: "2026-07" },
    { id: "r3", type: "expense", amount: 1, accountId: "bank", categoryId: "c1", note: "", dayOfMonth: 1, active: false, lastPosted: "2026-01" },
  ];
  const r = pendingRecurring(s, "2026-08-15", makeId);
  assertEqual(r.transactions.map(t => [t.date, t.amount, t.type, t.source, t.recurringId]), [
    ["2026-07-01", 60000, "expense", "recurring", "r1"],
    ["2026-08-01", 60000, "expense", "recurring", "r1"],
  ]);
  assertEqual(r.transactions[0].note, "Alquiler");
  assertEqual(r.recurring.find(x => x.id === "r1").lastPosted, "2026-08");
  assertEqual(r.recurring.find(x => x.id === "r2").lastPosted, "2026-07");
  assertEqual(r.recurring.find(x => x.id === "r3").lastPosted, "2026-01");
});

test("pendingRecurring devuelve el mismo array si no hay cambios", () => {
  const s = baseState();
  s.recurring = [{ id: "r1", type: "expense", amount: 1, accountId: "bank", categoryId: "c1", note: "", dayOfMonth: 20, active: true, lastPosted: "2026-09" }];
  const r = pendingRecurring(s, "2026-09-25", makeId);
  assertEqual(r.transactions, []);
  assertEqual(r.recurring === s.recurring, true);
});

test("initialLastPosted según si el día ya pasó", () => {
  assertEqual(initialLastPosted(5, "2026-09-07"), "2026-09");
  assertEqual(initialLastPosted(7, "2026-09-07"), "2026-09");
  assertEqual(initialLastPosted(20, "2026-09-07"), "2026-08");
});

test("validateTransaction devuelve errores en castellano", () => {
  assertEqual(validateTransaction({ type: "expense", amount: 100, date: "2026-09-07", accountId: "bank", categoryId: "c1" }), []);
  assertEqual(validateTransaction({ type: "transfer", amount: 100, date: "2026-09-07", accountId: "bank", toAccountId: "sav" }), []);
  assertEqual(validateTransaction({ type: "expense", amount: 0, date: "2026-09-07", accountId: "bank", categoryId: "c1" }), ["El importe debe ser mayor que cero"]);
  assertEqual(validateTransaction({ type: "transfer", amount: 100, date: "2026-09-07", accountId: "bank", toAccountId: "bank" }), ["Origen y destino deben ser distintos"]);
  assertEqual(validateTransaction({ type: "transfer", amount: 100, date: "2026-09-07", accountId: "bank", toAccountId: "" }), ["Elige la cuenta destino"]);
  assertEqual(validateTransaction({ type: "income", amount: 100, date: "2026-09-07", accountId: "bank", categoryId: "" }), ["Elige una categoría"]);
  assertEqual(validateTransaction({ type: "income", amount: 100, date: "", accountId: "bank", categoryId: "c1" }), ["Fecha no válida"]);
  assertEqual(validateTransaction({ type: "income", amount: 100, date: "2026-09-07", accountId: "", categoryId: "c1" }), ["Elige una cuenta"]);
});

test("accountInUse y categoryUsageCount", () => {
  const s = baseState();
  s.transactions = [tx({ type: "transfer", amount: 1, date: "2026-09-01", accountId: "bank", toAccountId: "sav" })];
  s.recurring = [{ id: "r", type: "expense", amount: 1, accountId: "tr", categoryId: "c2", note: "", dayOfMonth: 1, active: true, lastPosted: "2026-09" }];
  s.valuations = [{ id: "v", accountId: "btc", date: "2026-09-01", value: 1 }];
  assertEqual(accountInUse(s, "bank"), true);
  assertEqual(accountInUse(s, "sav"), true);
  assertEqual(accountInUse(s, "tr"), true);
  assertEqual(accountInUse(s, "btc"), true);
  assertEqual(accountInUse(s, "nueva"), false);
  assertEqual(categoryUsageCount(s, "c2"), 1);
  assertEqual(categoryUsageCount(s, "c1"), 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bash tests/run-tests.sh`
Expected: no `TESTS:` line (missing exports break the import).

- [ ] **Step 3: Append the implementation to `js/model.js`**

Also add `pad2` to the import line at the top: `import { monthKey, addMonths, lastDayOfMonth, monthRange, pad2 } from "./format.js";`

```js
export function pendingInterest(state, today, makeId) {
  const currentYm = monthKey(today);
  const transactions = [];
  const interestLastPosted = { ...(state.meta?.interestLastPosted || {}) };
  for (const acc of state.accounts) {
    if (acc.valuation !== "ledger" || !(acc.annualRate > 0)) continue;
    if (!interestLastPosted[acc.id]) { interestLastPosted[acc.id] = currentYm; continue; }
    let ym = addMonths(interestLastPosted[acc.id], 1);
    while (ym <= currentYm) {
      const working = { ...state, transactions: [...state.transactions, ...transactions] };
      const balance = accountBalance(working, acc.id, lastDayOfMonth(addMonths(ym, -1)));
      const amount = Math.round(balance * acc.annualRate / 100 / 12);
      if (amount > 0) {
        transactions.push({
          id: makeId(), type: "income", amount, date: `${ym}-01`, accountId: acc.id,
          categoryId: CAT_INTEREST, note: "", source: "interest",
        });
      }
      interestLastPosted[acc.id] = ym;
      ym = addMonths(ym, 1);
    }
  }
  return { transactions, interestLastPosted };
}

export function pendingRecurring(state, today, makeId) {
  const currentYm = monthKey(today);
  const transactions = [];
  let changed = false;
  const recurring = state.recurring.map(r => {
    if (!r.active) return r;
    let last = r.lastPosted;
    let ym = addMonths(last, 1);
    while (ym <= currentYm) {
      const date = `${ym}-${pad2(r.dayOfMonth)}`;
      if (date > today) break;
      transactions.push({
        id: makeId(), type: r.type, amount: r.amount, date, accountId: r.accountId,
        categoryId: r.categoryId, note: r.note || "", source: "recurring", recurringId: r.id,
      });
      last = ym;
      ym = addMonths(ym, 1);
    }
    if (last === r.lastPosted) return r;
    changed = true;
    return { ...r, lastPosted: last };
  });
  return { transactions, recurring: changed ? recurring : state.recurring };
}

export function initialLastPosted(dayOfMonth, today) {
  const ym = monthKey(today);
  const day = Number(today.slice(8, 10));
  return dayOfMonth <= day ? ym : addMonths(ym, -1);
}

export function validateTransaction(tx) {
  const errors = [];
  if (!Number.isInteger(tx.amount) || tx.amount <= 0) errors.push("El importe debe ser mayor que cero");
  if (!tx.accountId) errors.push("Elige una cuenta");
  if (tx.type === "transfer") {
    if (!tx.toAccountId) errors.push("Elige la cuenta destino");
    else if (tx.toAccountId === tx.accountId) errors.push("Origen y destino deben ser distintos");
  } else if (!tx.categoryId) {
    errors.push("Elige una categoría");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date || "")) errors.push("Fecha no válida");
  return errors;
}

export function accountInUse(state, accountId) {
  return state.transactions.some(t => t.accountId === accountId || t.toAccountId === accountId)
    || state.valuations.some(v => v.accountId === accountId)
    || state.recurring.some(r => r.accountId === accountId);
}

export function categoryUsageCount(state, categoryId) {
  return state.transactions.filter(t => t.categoryId === categoryId).length
    + state.recurring.filter(r => r.categoryId === categoryId).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bash tests/run-tests.sh`
Expected: `TESTS: 30 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add js/model.js tests/model.test.js
git commit -m "feat: interés automático, recurrentes y validaciones

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 4: `store.js` and `actions.js`

**Files:**
- Create: `js/store.js`, `js/actions.js`, `tests/store.test.js`
- Modify: `tests/tests.html` (add `import "./store.test.js";`)

**Interfaces:**
- Consumes: `todayStr, monthKey` (format), `CAT_*`, `pendingInterest`, `pendingRecurring`, `accountInUse` (model)
- Produces (`store.js`): `STORAGE_KEY = "finanzas.v1"`, `SCHEMA_VERSION = 1`, `uid()`, `defaultState(today?)`, `migrate(data)` (throws on invalid), `createStore({storage?, today?}) → {getState(), update(fn), subscribe(fn) → unsubscribe, replace(state), corrupt: bool}`, `postAutomatic(store, today?)`, `exportJSON(state) → string`, `parseImport(text) → state`
- Produces (`actions.js`): `addTransaction(store, tx)`, `updateTransaction(store, tx)`, `deleteTransaction(store, id)`, `addValuation(store, v)`, `saveAccount(store, acc, today?)`, `deleteAccount(store, id) → bool`, `saveCategory(store, cat)`, `deleteCategory(store, id) → bool`, `saveRecurring(store, r)`, `deleteRecurring(store, id)`

Default categories (id, name, color, icon): `cat-ocio` Ocio `#ff9f0a` 🎉, `cat-tabaco` Tabaco `#8e8e93` 🚬, `cat-mensual` Gasto mensual `#5e5ce6` 🏠, `cat-comida` Comida `#30d158` 🛒, `cat-transporte` Transporte `#64d2ff` 🚗, `cat-compras` Compras `#ff375f` 🛍️, `cat-salud` Salud `#ff453a` ❤️, `cat-suscripciones` Suscripciones `#bf5af2` 📺, `cat-other` Otros `#aeaeb2` 📦 (system), `cat-interest` Intereses `#ffd60a` 💰 (system), `cat-salary` Nómina `#34c759` 💼 (system).

- [ ] **Step 1: Write failing tests**

`tests/store.test.js`:
```js
import { test, assertEqual, assertThrows, assertTrue } from "./runner.js";
import { createStore, defaultState, migrate, postAutomatic, exportJSON, parseImport, STORAGE_KEY } from "../js/store.js";
import {
  addTransaction, updateTransaction, deleteTransaction, addValuation,
  saveAccount, deleteAccount, saveCategory, deleteCategory, saveRecurring, deleteRecurring
} from "../js/actions.js";
import { CAT_OTHER, CAT_INTEREST } from "../js/model.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    map,
  };
}
const TODAY = () => "2026-09-07";

test("defaultState crea 5 cuentas y 11 categorías", () => {
  const s = defaultState("2026-09-07");
  assertEqual(s.accounts.length, 5);
  assertEqual(s.accounts.map(a => a.valuation), ["ledger", "ledger", "ledger", "manual", "manual"]);
  assertEqual(s.categories.length, 11);
  assertTrue(s.categories.some(c => c.id === CAT_OTHER && c.system));
  assertTrue(s.categories.some(c => c.id === CAT_INTEREST && c.system));
  const tr = s.accounts.find(a => a.name === "Trade Republic efectivo");
  assertEqual(s.meta.interestLastPosted[tr.id], "2026-09");
});

test("createStore inicializa y persiste el estado por defecto", () => {
  const storage = fakeStorage();
  const store = createStore({ storage, today: TODAY });
  assertEqual(store.corrupt, false);
  assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).accounts.length, 5);
  assertEqual(store.getState().transactions, []);
});

test("createStore carga datos existentes y notifica cambios", () => {
  const existing = { ...defaultState("2026-09-07"), transactions: [{ id: "t1", type: "expense", amount: 1, date: "2026-09-01", accountId: "x", categoryId: "y", note: "", source: "manual" }] };
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify(existing) });
  const store = createStore({ storage, today: TODAY });
  assertEqual(store.getState().transactions.length, 1);
  let calls = 0;
  const unsub = store.subscribe(() => calls++);
  store.update(s => ({ ...s, transactions: [] }));
  store.update(s => s);
  assertEqual(calls, 1);
  assertEqual(JSON.parse(storage.getItem(STORAGE_KEY)).transactions, []);
  unsub();
  store.update(s => ({ ...s, transactions: [] }));
  assertEqual(calls, 1);
});

test("createStore marca corrupto y conserva el texto original", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: "{esto no es json" });
  const store = createStore({ storage, today: TODAY });
  assertEqual(store.corrupt, true);
  assertEqual(storage.getItem(STORAGE_KEY + ".corrupt"), "{esto no es json");
  assertEqual(store.getState().accounts.length, 5);
});

test("migrate rechaza formatos inválidos y rellena colecciones ausentes", () => {
  assertThrows(() => migrate(null));
  assertThrows(() => migrate({ schemaVersion: 99, accounts: [] }));
  assertThrows(() => migrate({ schemaVersion: 1 }));
  const m = migrate({ schemaVersion: 1, accounts: [], categories: [], transactions: [] });
  assertEqual(m.valuations, []);
  assertEqual(m.recurring, []);
  assertEqual(m.meta, { interestLastPosted: {} });
});

test("exportJSON y parseImport son inversos", () => {
  const s = defaultState("2026-09-07");
  assertEqual(parseImport(exportJSON(s)), s);
  assertThrows(() => parseImport("[]"));
});

test("postAutomatic añade intereses y recurrentes una sola vez", () => {
  const storage = fakeStorage();
  const store = createStore({ storage, today: TODAY });
  const tr = store.getState().accounts.find(a => a.name === "Trade Republic efectivo");
  const bank = store.getState().accounts.find(a => a.kind === "bank");
  store.update(s => ({ ...s,
    transactions: [{ id: "t", type: "transfer", amount: 120000, date: "2026-07-01", accountId: bank.id, toAccountId: tr.id, note: "", source: "manual" }],
    recurring: [{ id: "r", type: "expense", amount: 500, accountId: bank.id, categoryId: "cat-ocio", note: "", dayOfMonth: 3, active: true, lastPosted: "2026-08" }],
    meta: { interestLastPosted: { [tr.id]: "2026-08" } },
  }));
  postAutomatic(store, "2026-09-07");
  const txs = store.getState().transactions;
  assertEqual(txs.filter(t => t.source === "interest").length, 1);
  assertEqual(txs.find(t => t.source === "interest").amount, Math.round(120000 * tr.annualRate / 100 / 12));
  assertEqual(txs.filter(t => t.source === "recurring").map(t => t.date), ["2026-09-03"]);
  assertEqual(store.getState().meta.interestLastPosted[tr.id], "2026-09");
  postAutomatic(store, "2026-09-07");
  assertEqual(store.getState().transactions.length, 3);
});

test("acciones de movimientos y valoraciones", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  const bank = store.getState().accounts.find(a => a.kind === "bank");
  addTransaction(store, { id: "t1", type: "expense", amount: 100, date: "2026-09-07", accountId: bank.id, categoryId: "cat-ocio", note: "", source: "manual" });
  assertEqual(store.getState().transactions.length, 1);
  updateTransaction(store, { ...store.getState().transactions[0], amount: 200 });
  assertEqual(store.getState().transactions[0].amount, 200);
  deleteTransaction(store, "t1");
  assertEqual(store.getState().transactions, []);
  addValuation(store, { id: "v1", accountId: "btc", date: "2026-09-07", value: 5 });
  assertEqual(store.getState().valuations.length, 1);
});

test("saveAccount crea, actualiza y fija interestLastPosted al activar interés", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  saveAccount(store, { id: "n1", name: "Nueva", kind: "savings", valuation: "ledger", initialBalance: 0, annualRate: 0, color: "#000", icon: "x" }, "2026-09-07");
  assertEqual(store.getState().accounts.length, 6);
  assertEqual(store.getState().accounts.at(-1).order, 5);
  assertEqual(store.getState().meta.interestLastPosted.n1, undefined);
  saveAccount(store, { ...store.getState().accounts.at(-1), annualRate: 3 }, "2026-09-07");
  assertEqual(store.getState().accounts.length, 6);
  assertEqual(store.getState().meta.interestLastPosted.n1, "2026-09");
});

test("deleteAccount solo borra cuentas sin uso", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  const bank = store.getState().accounts.find(a => a.kind === "bank");
  const sav = store.getState().accounts.find(a => a.name === "Cuenta de ahorro");
  addTransaction(store, { id: "t1", type: "expense", amount: 100, date: "2026-09-07", accountId: bank.id, categoryId: "cat-ocio", note: "", source: "manual" });
  assertEqual(deleteAccount(store, bank.id), false);
  assertEqual(store.getState().accounts.length, 5);
  assertEqual(deleteAccount(store, sav.id), true);
  assertEqual(store.getState().accounts.length, 4);
});

test("saveCategory y deleteCategory reasignan a Otros y protegen las de sistema", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  const bank = store.getState().accounts.find(a => a.kind === "bank");
  saveCategory(store, { id: "c-new", name: "Mascotas", color: "#123456", icon: "🐶" });
  assertEqual(store.getState().categories.length, 12);
  assertEqual(store.getState().categories.at(-1).system, false);
  saveCategory(store, { ...store.getState().categories.at(-1), name: "Perro" });
  assertEqual(store.getState().categories.at(-1).name, "Perro");
  addTransaction(store, { id: "t1", type: "expense", amount: 100, date: "2026-09-07", accountId: bank.id, categoryId: "c-new", note: "", source: "manual" });
  saveRecurring(store, { id: "r1", type: "expense", amount: 1, accountId: bank.id, categoryId: "c-new", note: "", dayOfMonth: 1, active: true, lastPosted: "2026-09" });
  assertEqual(deleteCategory(store, "c-new"), true);
  assertEqual(store.getState().transactions[0].categoryId, CAT_OTHER);
  assertEqual(store.getState().recurring[0].categoryId, CAT_OTHER);
  assertEqual(deleteCategory(store, CAT_OTHER), false);
  assertEqual(store.getState().categories.length, 11);
});

test("saveRecurring y deleteRecurring", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  saveRecurring(store, { id: "r1", type: "income", amount: 1, accountId: "a", categoryId: "cat-salary", note: "", dayOfMonth: 28, active: true, lastPosted: "2026-08" });
  saveRecurring(store, { ...store.getState().recurring[0], amount: 2 });
  assertEqual(store.getState().recurring.length, 1);
  assertEqual(store.getState().recurring[0].amount, 2);
  deleteRecurring(store, "r1");
  assertEqual(store.getState().recurring, []);
});
```

Add to `tests/tests.html` after the model import:
```js
import "./store.test.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bash tests/run-tests.sh`
Expected: no `TESTS:` line.

- [ ] **Step 3: Implement `js/store.js`**

```js
import { todayStr, monthKey } from "./format.js";
import { CAT_INTEREST, CAT_SALARY, CAT_OTHER, pendingInterest, pendingRecurring } from "./model.js";

export const STORAGE_KEY = "finanzas.v1";
export const SCHEMA_VERSION = 1;

export function uid() {
  return crypto.randomUUID();
}

export function defaultState(today = todayStr()) {
  const ym = monthKey(today);
  const accounts = [
    { id: uid(), name: "Banco principal", kind: "bank", valuation: "ledger", initialBalance: 0, annualRate: 0, color: "#0a84ff", icon: "🏦", order: 0 },
    { id: uid(), name: "Cuenta de ahorro", kind: "savings", valuation: "ledger", initialBalance: 0, annualRate: 0, color: "#30d158", icon: "🐷", order: 1 },
    { id: uid(), name: "Trade Republic efectivo", kind: "savings", valuation: "ledger", initialBalance: 0, annualRate: 2, color: "#5e5ce6", icon: "💶", order: 2 },
    { id: uid(), name: "Trade Republic cartera", kind: "investment", valuation: "manual", initialBalance: 0, annualRate: 0, color: "#ff9f0a", icon: "📈", order: 3 },
    { id: uid(), name: "Bitcoin", kind: "crypto", valuation: "manual", initialBalance: 0, annualRate: 0, color: "#f7931a", icon: "₿", order: 4 },
  ];
  const cat = (id, name, color, icon, system = false, order = 0) => ({ id, name, color, icon, system, order });
  const categories = [
    cat("cat-ocio", "Ocio", "#ff9f0a", "🎉", false, 0),
    cat("cat-tabaco", "Tabaco", "#8e8e93", "🚬", false, 1),
    cat("cat-mensual", "Gasto mensual", "#5e5ce6", "🏠", false, 2),
    cat("cat-comida", "Comida", "#30d158", "🛒", false, 3),
    cat("cat-transporte", "Transporte", "#64d2ff", "🚗", false, 4),
    cat("cat-compras", "Compras", "#ff375f", "🛍️", false, 5),
    cat("cat-salud", "Salud", "#ff453a", "❤️", false, 6),
    cat("cat-suscripciones", "Suscripciones", "#bf5af2", "📺", false, 7),
    cat(CAT_OTHER, "Otros", "#aeaeb2", "📦", true, 8),
    cat(CAT_INTEREST, "Intereses", "#ffd60a", "💰", true, 9),
    cat(CAT_SALARY, "Nómina", "#34c759", "💼", true, 10),
  ];
  const interestLastPosted = {};
  for (const a of accounts) if (a.annualRate > 0) interestLastPosted[a.id] = ym;
  return { schemaVersion: SCHEMA_VERSION, accounts, valuations: [], categories, transactions: [], recurring: [], meta: { interestLastPosted } };
}

export function migrate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Formato no válido");
  if (data.schemaVersion !== SCHEMA_VERSION) throw new Error(`Versión de datos no soportada: ${data.schemaVersion}`);
  if (!Array.isArray(data.accounts) || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
    throw new Error("Faltan colecciones en los datos");
  }
  const out = { ...data };
  if (!Array.isArray(out.valuations)) out.valuations = [];
  if (!Array.isArray(out.recurring)) out.recurring = [];
  out.meta = { interestLastPosted: {}, ...(data.meta || {}) };
  return out;
}

export function createStore({ storage = globalThis.localStorage, today = todayStr } = {}) {
  let state;
  let corrupt = false;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw == null) {
    state = defaultState(today());
  } else {
    try {
      state = migrate(JSON.parse(raw));
    } catch {
      corrupt = true;
      storage.setItem(STORAGE_KEY + ".corrupt", raw);
      state = defaultState(today());
    }
  }
  const listeners = new Set();
  const save = () => storage.setItem(STORAGE_KEY, JSON.stringify(state));
  const notify = () => listeners.forEach(l => l(state));
  if (raw == null) save();
  return {
    get corrupt() { return corrupt; },
    getState: () => state,
    update(fn) {
      const next = fn(state);
      if (!next || next === state) return;
      state = next;
      save();
      notify();
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    replace(next) {
      state = migrate(next);
      corrupt = false;
      save();
      notify();
    },
  };
}

export function postAutomatic(store, today = todayStr()) {
  store.update(state => {
    const i = pendingInterest(state, today, uid);
    const r = pendingRecurring(state, today, uid);
    const sameInterest = JSON.stringify(i.interestLastPosted) === JSON.stringify(state.meta.interestLastPosted);
    if (!i.transactions.length && !r.transactions.length && r.recurring === state.recurring && sameInterest) return state;
    return {
      ...state,
      transactions: [...state.transactions, ...i.transactions, ...r.transactions],
      recurring: r.recurring,
      meta: { ...state.meta, interestLastPosted: i.interestLastPosted },
    };
  });
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function parseImport(text) {
  return migrate(JSON.parse(text));
}
```

- [ ] **Step 4: Implement `js/actions.js`**

```js
import { todayStr, monthKey } from "./format.js";
import { CAT_OTHER, accountInUse } from "./model.js";

export function addTransaction(store, tx) {
  store.update(s => ({ ...s, transactions: [...s.transactions, tx] }));
}

export function updateTransaction(store, tx) {
  store.update(s => ({ ...s, transactions: s.transactions.map(t => (t.id === tx.id ? tx : t)) }));
}

export function deleteTransaction(store, id) {
  store.update(s => ({ ...s, transactions: s.transactions.filter(t => t.id !== id) }));
}

export function addValuation(store, v) {
  store.update(s => ({ ...s, valuations: [...s.valuations, v] }));
}

export function saveAccount(store, acc, today = todayStr()) {
  store.update(s => {
    const exists = s.accounts.some(a => a.id === acc.id);
    const accounts = exists
      ? s.accounts.map(a => (a.id === acc.id ? { ...a, ...acc } : a))
      : [...s.accounts, { order: s.accounts.length, ...acc }];
    const interestLastPosted = { ...s.meta.interestLastPosted };
    if (acc.annualRate > 0 && !interestLastPosted[acc.id]) interestLastPosted[acc.id] = monthKey(today);
    return { ...s, accounts, meta: { ...s.meta, interestLastPosted } };
  });
}

export function deleteAccount(store, id) {
  if (accountInUse(store.getState(), id)) return false;
  store.update(s => {
    const interestLastPosted = { ...s.meta.interestLastPosted };
    delete interestLastPosted[id];
    return { ...s, accounts: s.accounts.filter(a => a.id !== id), meta: { ...s.meta, interestLastPosted } };
  });
  return true;
}

export function saveCategory(store, cat) {
  store.update(s => {
    const exists = s.categories.some(c => c.id === cat.id);
    const categories = exists
      ? s.categories.map(c => (c.id === cat.id ? { ...c, ...cat } : c))
      : [...s.categories, { system: false, order: s.categories.length, ...cat }];
    return { ...s, categories };
  });
}

export function deleteCategory(store, id) {
  const cat = store.getState().categories.find(c => c.id === id);
  if (!cat || cat.system) return false;
  store.update(s => ({
    ...s,
    categories: s.categories.filter(c => c.id !== id),
    transactions: s.transactions.map(t => (t.categoryId === id ? { ...t, categoryId: CAT_OTHER } : t)),
    recurring: s.recurring.map(r => (r.categoryId === id ? { ...r, categoryId: CAT_OTHER } : r)),
  }));
  return true;
}

export function saveRecurring(store, r) {
  store.update(s => {
    const exists = s.recurring.some(x => x.id === r.id);
    return { ...s, recurring: exists ? s.recurring.map(x => (x.id === r.id ? { ...x, ...r } : x)) : [...s.recurring, r] };
  });
}

export function deleteRecurring(store, id) {
  store.update(s => ({ ...s, recurring: s.recurring.filter(r => r.id !== id) }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bash tests/run-tests.sh`
Expected: `TESTS: 42 passed, 0 failed`

- [ ] **Step 6: Commit**

```bash
git add js/store.js js/actions.js tests
git commit -m "feat: store persistente, acciones y registro automático

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 5: App shell — `index.html`, CSS, `ui.js`, `app.js`, smoke test

**Files:**
- Create: `index.html`, `css/base.css`, `css/components.css`, `js/ui.js`, `js/app.js`, `js/views/home.js` (placeholder), `js/views/transactions.js` (placeholder), `js/views/stats.js` (placeholder), `js/views/settings.js` (placeholder), `tests/smoke.sh`

**Interfaces:**
- Produces (`ui.js`): `h(tag, attrs, ...children) → HTMLElement`, `openSheet({title, content, saveLabel?, onSave?}) → {close}`, `toast(msg)`, `monthPicker(ym, onChange) → HTMLElement`, `iconBubble(icon, color, size?) → HTMLElement`, `field(label, control) → HTMLElement`, `select(options, value, onChange) → HTMLSelectElement`, `swipeRow(contentEl, onDelete) → HTMLElement`, `emptyState(text) → HTMLElement`
- Produces (`app.js`): each view is called as `renderX(container, ctx)` with `ctx = { store, ui, navigate }`, where `ui = { month, statsMonth, statsCategory, statsBar, settingsPage }` is mutable shared UI state and `navigate(tab)` switches tab. Views must append into `container` (already emptied).
- `h` attribute rules: `class` → className; `style` object → assigned; `onClick`/`onInput`/… → `addEventListener`; keys `value, checked, selected, disabled` → set as properties; everything else → `setAttribute`. Children may be strings, nodes, arrays, `null`/`false` (skipped).

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<title>Finanzas</title>
<meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Finanzas">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="stylesheet" href="./css/base.css">
<link rel="stylesheet" href="./css/components.css">
</head>
<body>
<main id="view"></main>
<nav class="tabbar" aria-label="Pestañas">
  <a href="#home" data-tab="home">
    <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
    <span>Inicio</span>
  </a>
  <a href="#transactions" data-tab="transactions">
    <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
    <span>Movimientos</span>
  </a>
  <a href="#stats" data-tab="stats">
    <svg viewBox="0 0 24 24"><path d="M5 20V12M11 20V4M17 20v-7M2 21h20"/></svg>
    <span>Estadísticas</span>
  </a>
  <a href="#settings" data-tab="settings">
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    <span>Ajustes</span>
  </a>
</nav>
<script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `css/base.css`**

```css
:root {
  color-scheme: light dark;
  --bg: #f2f2f7;
  --card: #ffffff;
  --card-2: #f2f2f7;
  --text: #000000;
  --text-2: #6e6e73;
  --text-3: #aeaeb2;
  --sep: rgba(60, 60, 67, 0.2);
  --accent: #0a84ff;
  --red: #ff3b30;
  --green: #34c759;
  --orange: #ff9500;
  --tab-bg: rgba(249, 249, 249, 0.92);
  --overlay: rgba(0, 0, 0, 0.35);
  --radius: 16px;
  --radius-sm: 10px;
  --tab-h: 50px;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --card: #1c1c1e;
    --card-2: #2c2c2e;
    --text: #ffffff;
    --text-2: #98989f;
    --text-3: #636366;
    --sep: rgba(84, 84, 88, 0.55);
    --tab-bg: rgba(22, 22, 23, 0.92);
    --overlay: rgba(0, 0, 0, 0.6);
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 17px;
  line-height: 1.3;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: none;
}
body.no-scroll { overflow: hidden; }
button, input, select { font: inherit; color: inherit; }
button { background: none; border: 0; padding: 0; cursor: pointer; }
a { color: inherit; text-decoration: none; }
h1, h2, h3 { margin: 0; }

#view {
  padding: calc(env(safe-area-inset-top) + 8px) 16px calc(var(--tab-h) + env(safe-area-inset-bottom) + 24px);
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
}

.page-header { padding: 8px 0 12px; }
.page-header h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.4px; }
.section-title {
  font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;
  color: var(--text-2); margin: 20px 4px 8px;
}
.muted { color: var(--text-2); }
.small { font-size: 13px; }
.pos { color: var(--green); }
.neg { color: var(--red); }
.bold { font-weight: 600; }
.num { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 3: Write `css/components.css`**

```css
/* Cards and lists */
.card { background: var(--card); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text-2); margin-bottom: 10px; }
.list { padding: 0; overflow: hidden; }
.row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; min-height: 60px; background: var(--card); position: relative; }
.row + .row::before, .swipe + .swipe .row::before {
  content: ""; position: absolute; left: 64px; right: 0; top: 0; height: 1px; background: var(--sep);
}
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-sub { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-amount { font-variant-numeric: tabular-nums; font-weight: 500; white-space: nowrap; }
.row.tappable:active { background: var(--card-2); }
.chevron { color: var(--text-3); font-size: 20px; }
.badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 6px; background: var(--card-2); color: var(--text-2); margin-left: 6px; vertical-align: middle; }
.bubble { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; flex: none; line-height: 1; }
.group-header { font-size: 13px; font-weight: 600; color: var(--text-2); margin: 16px 4px 6px; }
.empty { text-align: center; color: var(--text-2); padding: 40px 16px; }

/* Hero */
.hero { text-align: center; padding: 8px 0 20px; }
.hero-label { font-size: 15px; color: var(--text-2); }
.hero-value { font-size: 40px; font-weight: 700; letter-spacing: -0.8px; font-variant-numeric: tabular-nums; }

/* Rings */
.rings-row { display: flex; justify-content: space-around; gap: 8px; }
.ring-stat { text-align: center; flex: 1; }
.ring-value { font-size: 14px; font-weight: 600; margin-top: 6px; font-variant-numeric: tabular-nums; }
.ring-label { font-size: 12px; color: var(--text-2); }
.ring circle { transition: stroke-dasharray 0.6s ease; }

/* Month picker */
.month-picker { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 12px; }
.month-label { font-size: 17px; font-weight: 600; }
.btn-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--card); color: var(--accent); font-size: 24px; display: inline-flex; align-items: center; justify-content: center; }

/* Buttons */
.btn-text { color: var(--accent); font-size: 17px; padding: 8px 4px; }
.btn-primary { display: block; width: 100%; padding: 14px; border-radius: var(--radius-sm); background: var(--accent); color: #fff; font-weight: 600; text-align: center; }
.btn-secondary { display: block; width: 100%; padding: 14px; border-radius: var(--radius-sm); background: var(--card); color: var(--accent); font-weight: 600; text-align: center; }
.btn-danger { display: block; width: 100%; padding: 14px; border-radius: var(--radius-sm); background: var(--card); color: var(--red); font-weight: 600; text-align: center; margin-top: 20px; }
.btn-row { display: flex; gap: 10px; margin-top: 10px; }
.btn-row > * { flex: 1; }

/* FAB */
.fab {
  position: fixed; right: 20px; bottom: calc(var(--tab-h) + env(safe-area-inset-bottom) + 16px);
  width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: #fff;
  font-size: 32px; line-height: 1; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(10, 132, 255, 0.4); z-index: 20;
}
.fab:active { transform: scale(0.94); }

/* Tab bar */
.tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; justify-content: space-around;
  height: calc(var(--tab-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--tab-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--sep);
}
.tabbar a { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 10px; color: var(--text-2); }
.tabbar a.active { color: var(--accent); }
.tabbar svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tabbar a.active svg { stroke-width: 2.2; }

/* Segmented control */
.segmented { display: flex; background: var(--card-2); border-radius: 9px; padding: 2px; margin-bottom: 16px; }
.segmented button { flex: 1; padding: 7px 0; border-radius: 7px; font-size: 14px; font-weight: 500; color: var(--text); }
.segmented button.active { background: var(--card); box-shadow: 0 1px 3px rgba(0,0,0,0.15); font-weight: 600; }
@media (prefers-color-scheme: dark) { .segmented button.active { background: #636366; } }

/* Forms */
.field { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--sep); }
.field:last-of-type { border-bottom: 0; }
.field-label { font-size: 16px; flex: none; }
.field-label.block { display: block; margin: 12px 0 8px; color: var(--text-2); font-size: 13px; font-weight: 600; text-transform: uppercase; }
.input { flex: 1; min-width: 0; text-align: right; background: transparent; border: 0; padding: 4px 0; font-size: 16px; -webkit-appearance: none; appearance: none; outline: none; }
.input.left { text-align: left; }
select.input { direction: rtl; }
select.input option { direction: ltr; }
.amount-wrap { display: flex; align-items: baseline; justify-content: center; gap: 6px; padding: 8px 0 16px; }
.amount-input { font-size: 44px; font-weight: 700; width: 60%; text-align: right; background: transparent; border: 0; outline: none; font-variant-numeric: tabular-nums; }
.amount-cur { font-size: 28px; color: var(--text-2); }
.chip-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
.chip { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--text-2); padding: 4px 0; border-radius: 12px; }
.chip.active { color: var(--text); background: var(--card-2); }
.chip.active .bubble { box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--accent); }
.color-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.color-dot { width: 26px; height: 26px; border-radius: 50%; }
.color-dot.active { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--accent); }
.switch { width: 51px; height: 31px; border-radius: 16px; background: var(--text-3); position: relative; flex: none; transition: background 0.2s; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.switch.on { background: var(--green); }
.switch.on::after { transform: translateX(20px); }

/* Sheet */
.sheet-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 40; opacity: 0; transition: opacity 0.25s; display: flex; align-items: flex-end; justify-content: center; }
.sheet-overlay.open { opacity: 1; }
.sheet { width: 100%; max-width: 640px; max-height: 92vh; background: var(--card); border-radius: 20px 20px 0 0; padding: 6px 16px calc(env(safe-area-inset-bottom) + 16px); transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); display: flex; flex-direction: column; }
.sheet-overlay.open .sheet { transform: translateY(0); }
.sheet-handle { width: 36px; height: 5px; border-radius: 3px; background: var(--text-3); margin: 4px auto 8px; }
.sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sheet-title { font-weight: 600; }
.sheet-body { overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1; }

/* Toast */
.toast { position: fixed; left: 50%; bottom: calc(var(--tab-h) + env(safe-area-inset-bottom) + 24px); transform: translate(-50%, 20px); background: var(--text); color: var(--bg); padding: 10px 18px; border-radius: 20px; font-size: 14px; opacity: 0; transition: all 0.25s; z-index: 50; max-width: 90%; text-align: center; }
.toast.show { opacity: 1; transform: translate(-50%, 0); }

/* Swipe rows */
.swipe { position: relative; overflow: hidden; background: var(--red); }
.swipe-delete { position: absolute; right: 0; top: 0; bottom: 0; width: 88px; color: #fff; font-weight: 600; }
.swipe-content { position: relative; transition: transform 0.2s; }

/* Charts */
.chart-wrap { width: 100%; }
.chart-wrap svg { width: 100%; height: auto; display: block; }
.donut { max-width: 240px; margin: 0 auto; }
.donut-center { font-size: 22px; font-weight: 700; fill: var(--text); }
.donut-sub { font-size: 12px; fill: var(--text-2); }
.donut-slice { cursor: pointer; transition: opacity 0.2s; }
.axis-label { font-size: 10px; fill: var(--text-2); }
.point-label { font-size: 11px; font-weight: 600; fill: var(--text); }
.legend { margin-top: 12px; }
.legend-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--sep); cursor: pointer; }
.legend-row:last-child { border-bottom: 0; }
.legend-row.dim { opacity: 0.4; }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.legend-name { flex: 1; }
.legend-pct { color: var(--text-2); font-size: 13px; width: 44px; text-align: right; }
.legend-inline { display: flex; gap: 14px; font-size: 12px; color: var(--text-2); margin-top: 8px; flex-wrap: wrap; }
.legend-inline span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; background: var(--dot); vertical-align: middle; }
.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; text-align: center; }
.stat-grid .v { font-weight: 600; font-variant-numeric: tabular-nums; font-size: 14px; }
.stat-grid .l { font-size: 12px; color: var(--text-2); }

/* Settings */
.settings-back { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-size: 17px; margin-bottom: 8px; }
.warning { background: rgba(255, 149, 0, 0.15); color: var(--orange); border-radius: var(--radius); padding: 12px 16px; margin-bottom: 12px; font-size: 14px; }
```

- [ ] **Step 4: Write `js/ui.js`**

```js
import { addMonths, monthLabel, capitalize } from "./format.js";

const PROPS = new Set(["value", "checked", "selected", "disabled", "textContent"]);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith("--")) el.style.setProperty(prop, val); else el.style[prop] = val;
      }
    }
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function openSheet({ title, content, saveLabel = "Guardar", onSave }) {
  const overlay = h("div", { class: "sheet-overlay" });
  const close = () => {
    overlay.classList.remove("open");
    document.body.classList.remove("no-scroll");
    setTimeout(() => overlay.remove(), 300);
  };
  const saveBtn = onSave
    ? h("button", { class: "btn-text bold", type: "button", onClick: async () => { if ((await onSave()) !== false) close(); } }, saveLabel)
    : h("span");
  const sheet = h("div", { class: "sheet" },
    h("div", { class: "sheet-handle" }),
    h("div", { class: "sheet-header" },
      h("button", { class: "btn-text", type: "button", onClick: close }, "Cancelar"),
      h("div", { class: "sheet-title" }, title),
      saveBtn),
    h("div", { class: "sheet-body" }, content));
  overlay.append(sheet);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => overlay.classList.add("open"));
  return { close };
}

export function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

export function monthPicker(ym, onChange) {
  return h("div", { class: "month-picker" },
    h("button", { class: "btn-icon", type: "button", "aria-label": "Mes anterior", onClick: () => onChange(addMonths(ym, -1)) }, "‹"),
    h("span", { class: "month-label" }, capitalize(monthLabel(ym))),
    h("button", { class: "btn-icon", type: "button", "aria-label": "Mes siguiente", onClick: () => onChange(addMonths(ym, 1)) }, "›"));
}

export function iconBubble(icon, color, size = 36) {
  return h("span", { class: "bubble", style: { background: color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` } }, icon);
}

export function field(label, control) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control);
}

export function select(options, value, onChange) {
  const s = h("select", { class: "input", onChange: e => onChange(e.target.value) });
  for (const o of options) s.append(h("option", { value: o.value }, o.label));
  s.value = value ?? "";
  return s;
}

export function emptyState(text) {
  return h("div", { class: "empty" }, text);
}

export function swipeRow(content, onDelete) {
  content.classList.add("swipe-content");
  const wrap = h("div", { class: "swipe" },
    h("button", { class: "swipe-delete", type: "button", onClick: onDelete }, "Borrar"),
    content);
  let startX = 0, startY = 0, dx = 0, open = false, dragging = false;
  content.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dragging = false; content.style.transition = "none";
  }, { passive: true });
  content.addEventListener("touchmove", e => {
    const mx = e.touches[0].clientX - startX, my = e.touches[0].clientY - startY;
    if (!dragging && Math.abs(mx) < Math.abs(my)) return;
    dragging = true;
    dx = Math.max(-88, Math.min(0, mx + (open ? -88 : 0)));
    content.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  content.addEventListener("touchend", () => {
    content.style.transition = "";
    open = dragging ? dx < -44 : false;
    content.style.transform = open ? "translateX(-88px)" : "";
  });
  content.addEventListener("click", e => {
    if (dragging) { e.stopPropagation(); e.preventDefault(); dragging = false; }
  }, true);
  return wrap;
}
```

- [ ] **Step 5: Write placeholder views and `js/app.js`**

Each placeholder (`js/views/home.js`, `transactions.js`, `stats.js`, `settings.js`) exports one function; later tasks replace them. Example for home (repeat with the right name/title for the other three: `renderTransactions`/"Movimientos", `renderStats`/"Estadísticas", `renderSettings`/"Ajustes"):
```js
import { h } from "../ui.js";

export function renderHome(el) {
  el.append(h("header", { class: "page-header" }, h("h1", null, "Inicio")));
}
```

`js/app.js`:
```js
import { createStore, postAutomatic } from "./store.js";
import { todayStr, monthKey } from "./format.js";
import { renderHome } from "./views/home.js";
import { renderTransactions } from "./views/transactions.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";

const store = createStore();
postAutomatic(store);

const views = { home: renderHome, transactions: renderTransactions, stats: renderStats, settings: renderSettings };
const main = document.getElementById("view");
const currentYm = monthKey(todayStr());
const ui = { month: currentYm, statsMonth: currentYm, statsCategory: null, statsBar: 11, settingsPage: "root" };

let current = tabFromHash();

function tabFromHash() {
  const t = location.hash.slice(1);
  return views[t] ? t : "home";
}

function navigate(tab) {
  if (!views[tab]) return;
  current = tab;
  if (location.hash !== `#${tab}`) location.hash = tab;
  render();
}

function render() {
  const scrollY = window.scrollY;
  main.innerHTML = "";
  views[current](main, { store, ui, navigate });
  document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === current));
  window.scrollTo(0, scrollY);
}

window.addEventListener("hashchange", () => {
  const t = tabFromHash();
  if (t !== current) { current = t; window.scrollTo(0, 0); render(); }
});
store.subscribe(render);
render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
```

- [ ] **Step 6: Write `tests/smoke.sh`**

Dumps the rendered `index.html` in headless Edge and checks that the app booted (a JS error leaves the view empty).
```bash
#!/usr/bin/env bash
# Usage: bash tests/smoke.sh [hash] [expected-text]
EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
ROOT="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || pwd)"
HASH="${1:-home}"
EXPECT="${2:-Inicio}"
OUT="$("$EDGE" --headless=new --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=5000 --dump-dom "file:///$ROOT/index.html#$HASH" 2>/dev/null)"
if grep -q "$EXPECT" <<<"$OUT"; then echo "SMOKE OK: #$HASH contiene '$EXPECT'"; else echo "SMOKE FAIL: #$HASH sin '$EXPECT'"; exit 1; fi
```

- [ ] **Step 7: Verify shell renders and tests still pass**

Run: `bash tests/smoke.sh home "Inicio" && bash tests/smoke.sh settings "Ajustes" && bash tests/run-tests.sh`
Expected: two `SMOKE OK` lines and `TESTS: 42 passed, 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add index.html css js tests
git commit -m "feat: esqueleto de la app con tab bar, estilos iOS y helpers de UI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 6: `charts.js` and Home view

**Files:**
- Create: `js/charts.js`
- Modify: `js/views/home.js` (replace placeholder)
- Create: `js/views/sheet-transaction.js` and `js/views/sheet-valuation.js` as **stubs** (real implementation in Task 7):
  ```js
  // js/views/sheet-transaction.js (stub)
  export function openTransactionSheet() { alert("Pendiente"); }
  ```
  ```js
  // js/views/sheet-valuation.js (stub)
  export function openValuationSheet() { alert("Pendiente"); }
  ```

**Interfaces:**
- Produces (`charts.js`): `svg(tag, attrs, ...children)`, `ringChart({fraction, color, size?, stroke?}) → SVGElement`, `donutChart({slices:[{id,label,value,color}], centerTop, centerBottom, selectedId?, onSelect?}) → SVGElement`, `barChart({groups:[{label, values:number[]}], series:[{name,color}], selectedIndex?, onSelect?, average?}) → SVGElement`, `lineChart({points:[{label,value}], format}) → SVGElement`
- Consumes: `openTransactionSheet({store, tx?, defaultType?})`, `openValuationSheet({store, account})`

- [ ] **Step 1: Write `js/charts.js`**

```js
const NS = "http://www.w3.org/2000/svg";

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function ringChart({ fraction, color, size = 84, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction || 0));
  const common = { cx: size / 2, cy: size / 2, r, fill: "none", "stroke-width": stroke };
  return svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "ring" },
    svg("circle", { ...common, stroke: color, "stroke-opacity": 0.2 }),
    svg("circle", { ...common, stroke: color, "stroke-linecap": "round", "stroke-dasharray": `${c * f} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }));
}

export function donutChart({ slices, centerTop, centerBottom, selectedId = null, onSelect }) {
  const size = 220, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const el = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "donut" });
  if (total === 0) {
    el.append(svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--sep)", "stroke-width": stroke }));
  }
  let offset = 0;
  for (const s of slices) {
    if (s.value <= 0) continue;
    const len = c * s.value / total;
    const gap = slices.length > 1 ? 2 : 0;
    const circle = svg("circle", {
      cx: size / 2, cy: size / 2, r, fill: "none", stroke: s.color, class: "donut-slice",
      "stroke-width": selectedId === s.id ? stroke + 6 : stroke,
      "stroke-dasharray": `${Math.max(0, len - gap)} ${c - len + gap}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      opacity: selectedId && selectedId !== s.id ? 0.35 : 1,
    });
    circle.addEventListener("click", () => onSelect?.(s.id));
    el.append(circle);
    offset += len;
  }
  el.append(
    svg("text", { x: size / 2, y: size / 2 - 2, "text-anchor": "middle", class: "donut-center" }, centerTop),
    svg("text", { x: size / 2, y: size / 2 + 18, "text-anchor": "middle", class: "donut-sub" }, centerBottom));
  return el;
}

export function barChart({ groups, series, selectedIndex = null, onSelect, average = null }) {
  const W = 340, H = 180, padX = 6, padT = 12, padB = 22;
  const max = Math.max(1, ...groups.flatMap(g => g.values), average ?? 0);
  const gw = (W - padX * 2) / Math.max(1, groups.length);
  const n = Math.max(1, series.length);
  const bw = Math.max(2, (gw - 6) / n);
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "bars" });
  groups.forEach((g, i) => {
    const gx = padX + i * gw;
    const grp = svg("g", { class: "bar-group", opacity: selectedIndex != null && selectedIndex !== i ? 0.4 : 1, style: "cursor:pointer" });
    grp.append(svg("rect", { x: gx, y: 0, width: gw, height: H, fill: "transparent" }));
    g.values.forEach((v, j) => {
      const top = y(v);
      grp.append(svg("rect", { x: gx + 3 + j * bw, y: top, width: Math.max(1, bw - 1.5), height: Math.max(0, H - padB - top), rx: 2, fill: series[j].color }));
    });
    grp.append(svg("text", { x: gx + gw / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }, g.label));
    grp.addEventListener("click", () => onSelect?.(i));
    el.append(grp);
  });
  if (average != null) {
    el.append(svg("line", { x1: padX, x2: W - padX, y1: y(average), y2: y(average), stroke: "var(--text-2)", "stroke-dasharray": "4 3", "stroke-width": 1 }));
  }
  return el;
}

export function lineChart({ points, format }) {
  const W = 340, H = 160, pad = 14, padB = 20;
  const vals = points.map(p => p.value);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const x = i => (points.length === 1 ? W / 2 : pad + (W - pad * 2) * i / (points.length - 1));
  const y = v => pad + (H - pad - padB) * (1 - (v - min) / (max - min || 1));
  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`);
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "line" });
  const first = points[0], last = points[points.length - 1];
  el.append(
    svg("polygon", { points: [`${x(0)},${H - padB}`, ...coords, `${x(points.length - 1)},${H - padB}`].join(" "), fill: "var(--accent)", opacity: 0.12 }),
    svg("polyline", { points: coords.join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    svg("circle", { cx: x(points.length - 1), cy: y(last.value), r: 4, fill: "var(--accent)" }),
    svg("text", { x: x(0), y: H - 4, class: "axis-label" }, first.label),
    svg("text", { x: x(points.length - 1), y: H - 4, "text-anchor": "end", class: "axis-label" }, last.label),
    svg("text", { x: x(points.length - 1), y: y(last.value) - 10, "text-anchor": "end", class: "point-label" }, format(last.value)));
  if (points.length > 1) {
    el.append(svg("text", { x: x(0), y: y(first.value) - 10, class: "point-label" }, format(first.value)));
  }
  return el;
}
```

- [ ] **Step 2: Write `js/views/home.js`**

```js
import { h, iconBubble } from "../ui.js";
import { ringChart } from "../charts.js";
import { formatMoney, todayStr, monthKey, monthLabel, capitalize } from "../format.js";
import { netWorth, monthSummary, accountBalance } from "../model.js";
import { openTransactionSheet } from "./sheet-transaction.js";
import { openValuationSheet } from "./sheet-valuation.js";

const KIND_LABEL = { bank: "Cuenta corriente", savings: "Ahorro", investment: "Inversión", crypto: "Cripto" };

export function renderHome(el, { store }) {
  const state = store.getState();
  const ym = monthKey(todayStr());
  const summary = monthSummary(state, ym);
  const share = part => (summary.income > 0 ? Math.min(1, part / summary.income) : part > 0 ? 1 : 0);

  const ringStat = (label, value, fraction, color) =>
    h("div", { class: "ring-stat" },
      ringChart({ fraction, color, size: 84 }),
      h("div", { class: "ring-value" }, formatMoney(value)),
      h("div", { class: "ring-label" }, label));

  const accountRow = acc => {
    const sub = acc.valuation === "manual"
      ? "Toca para actualizar el valor"
      : acc.annualRate > 0 ? `${String(acc.annualRate).replace(".", ",")} % anual` : KIND_LABEL[acc.kind] || "";
    return h("div", {
      class: "row" + (acc.valuation === "manual" ? " tappable" : ""),
      onClick: acc.valuation === "manual" ? () => openValuationSheet({ store, account: acc }) : null,
    },
      iconBubble(acc.icon, acc.color, 40),
      h("div", { class: "row-main" }, h("div", { class: "row-title" }, acc.name), h("div", { class: "row-sub" }, sub)),
      h("div", { class: "row-amount" }, formatMoney(accountBalance(state, acc.id))));
  };

  el.append(
    h("header", { class: "page-header" }, h("h1", null, "Inicio")),
    h("section", { class: "hero" },
      h("div", { class: "hero-label" }, "Patrimonio total"),
      h("div", { class: "hero-value" }, formatMoney(netWorth(state)))),
    h("section", { class: "card" },
      h("div", { class: "card-title" }, capitalize(monthLabel(ym))),
      h("div", { class: "rings-row" },
        ringStat("Ingresos", summary.income, summary.income > 0 ? 1 : 0, "var(--green)"),
        ringStat("Gastos", summary.expense, share(summary.expense), "var(--red)"),
        ringStat("Ahorrado", summary.savings, share(summary.savings), "var(--accent)"))),
    h("div", { class: "section-title" }, "Cuentas"),
    h("div", { class: "card list" }, [...state.accounts].sort((a, b) => a.order - b.order).map(accountRow)),
    h("button", { class: "fab", type: "button", "aria-label": "Añadir movimiento", onClick: () => openTransactionSheet({ store }) }, "+"));
}
```

- [ ] **Step 3: Verify**

Run: `bash tests/smoke.sh home "Patrimonio total" && bash tests/smoke.sh home "Trade Republic" && bash tests/run-tests.sh`
Expected: two `SMOKE OK` lines and `TESTS: 42 passed, 0 failed`.

- [ ] **Step 4: Commit**

```bash
git add js
git commit -m "feat: gráficas SVG y pantalla de inicio con anillos y cuentas

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 7: Transaction sheet and valuation sheet

**Files:**
- Modify (replace stubs): `js/views/sheet-transaction.js`, `js/views/sheet-valuation.js`

**Interfaces:**
- Produces: `openTransactionSheet({store, tx = null, defaultType = "expense"})`, `openValuationSheet({store, account})`
- Consumes: `openSheet, h, field, select, iconBubble, toast` (ui), `parseAmount, todayStr, formatMoney` (format), `validateTransaction` (model), `uid` (store), `addTransaction, updateTransaction, deleteTransaction, addValuation` (actions)

- [ ] **Step 1: Write `js/views/sheet-transaction.js`**

```js
import { h, openSheet, field, select, iconBubble, toast } from "../ui.js";
import { parseAmount, todayStr } from "../format.js";
import { validateTransaction } from "../model.js";
import { uid } from "../store.js";
import { addTransaction, updateTransaction, deleteTransaction } from "../actions.js";

const TYPES = [["expense", "Gasto"], ["income", "Ingreso"], ["transfer", "Transferencia"]];

export function openTransactionSheet({ store, tx = null, defaultType = "expense" }) {
  const state = store.getState();
  const accounts = [...state.accounts].sort((a, b) => a.order - b.order);
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  const defaultAccount = accounts.find(a => a.kind === "bank") || accounts[0];
  const form = tx
    ? { ...tx }
    : { type: defaultType, amount: 0, date: todayStr(), accountId: defaultAccount?.id || "", toAccountId: "", categoryId: "", note: "" };
  let amountText = tx ? (tx.amount / 100).toFixed(2).replace(".", ",") : "";
  let firstRender = true;

  const body = h("div");
  const sheet = openSheet({ title: tx ? "Editar movimiento" : "Nuevo movimiento", content: body, onSave: save });
  render();

  function render() {
    body.innerHTML = "";
    const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));
    const amount = h("input", { class: "amount-input", inputmode: "decimal", placeholder: "0,00", value: amountText, onInput: e => { amountText = e.target.value; } });
    const parts = [
      h("div", { class: "segmented" }, TYPES.map(([v, label]) =>
        h("button", { type: "button", class: v === form.type ? "active" : "", onClick: () => { form.type = v; render(); } }, label))),
      h("div", { class: "amount-wrap" }, amount, h("span", { class: "amount-cur" }, "€")),
      field(form.type === "transfer" ? "Desde" : "Cuenta", select(accountOptions, form.accountId, v => { form.accountId = v; })),
    ];
    if (form.type === "transfer") {
      parts.push(field("Hacia", select([{ value: "", label: "Elegir…" }, ...accountOptions], form.toAccountId, v => { form.toAccountId = v; })));
    } else {
      parts.push(
        h("div", { class: "field-label block" }, "Categoría"),
        h("div", { class: "chip-grid" }, categories.map(c =>
          h("button", { type: "button", class: "chip" + (c.id === form.categoryId ? " active" : ""), onClick: () => { form.categoryId = c.id; render(); } },
            iconBubble(c.icon, c.color, 44), h("span", null, c.name)))));
    }
    parts.push(
      field("Fecha", h("input", { class: "input", type: "date", value: form.date, onInput: e => { form.date = e.target.value; } })),
      field("Nota", h("input", { class: "input", type: "text", placeholder: "Opcional", value: form.note, onInput: e => { form.note = e.target.value; } })));
    if (tx) {
      parts.push(h("button", { type: "button", class: "btn-danger", onClick: () => {
        if (confirm("¿Borrar este movimiento?")) { deleteTransaction(store, tx.id); sheet.close(); }
      } }, "Borrar movimiento"));
    }
    body.append(...parts);
    if (firstRender && !tx) { firstRender = false; setTimeout(() => amount.focus(), 350); }
    firstRender = false;
  }

  function save() {
    const cents = parseAmount(amountText);
    const candidate = { ...form, amount: cents ?? 0, note: (form.note || "").trim() };
    if (candidate.type === "transfer") candidate.categoryId = ""; else candidate.toAccountId = "";
    const errors = validateTransaction(candidate);
    if (errors.length) { toast(errors[0]); return false; }
    if (tx) updateTransaction(store, candidate);
    else addTransaction(store, { ...candidate, id: uid(), source: "manual" });
    return true;
  }
}
```

- [ ] **Step 2: Write `js/views/sheet-valuation.js`**

```js
import { h, openSheet, field, toast } from "../ui.js";
import { parseAmount, todayStr, formatMoney } from "../format.js";
import { accountBalance } from "../model.js";
import { uid } from "../store.js";
import { addValuation } from "../actions.js";

export function openValuationSheet({ store, account }) {
  const current = accountBalance(store.getState(), account.id);
  let valueText = (current / 100).toFixed(2).replace(".", ",");
  let date = todayStr();
  const body = h("div",
    h("p", { class: "muted small" }, `Valor actual de ${account.name}: ${formatMoney(current)}. Introduce el valor total que muestra la app de ${account.name} hoy.`),
    h("div", { class: "amount-wrap" },
      h("input", { class: "amount-input", inputmode: "decimal", value: valueText, onInput: e => { valueText = e.target.value; } }),
      h("span", { class: "amount-cur" }, "€")),
    field("Fecha", h("input", { class: "input", type: "date", value: date, onInput: e => { date = e.target.value; } })));
  openSheet({
    title: "Actualizar valor",
    content: body,
    onSave() {
      const value = parseAmount(valueText);
      if (value == null) { toast("Introduce un valor válido"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Fecha no válida"); return false; }
      addValuation(store, { id: uid(), accountId: account.id, date, value });
      toast("Valor actualizado");
      return true;
    },
  });
}
```

- [ ] **Step 3: Verify**

Run: `bash tests/smoke.sh home "Patrimonio total" && bash tests/run-tests.sh`
Expected: `SMOKE OK` and `TESTS: 42 passed, 0 failed`. Then open `index.html` in Edge normally (`start index.html` from PowerShell), press `+`, add an expense of `12,5` in Ocio and confirm the Gastos ring shows `12,50 €`. Tap Bitcoin, set `1000`, confirm net worth updates.

- [ ] **Step 4: Commit**

```bash
git add js/views
git commit -m "feat: hojas de nuevo movimiento y actualización de valor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 8: Transactions view

**Files:**
- Modify (replace placeholder): `js/views/transactions.js`

**Interfaces:**
- Produces: `renderTransactions(el, {store, ui})` using `ui.month`
- Consumes: `monthPicker, swipeRow, iconBubble, emptyState, h` (ui), `openTransactionSheet`, `deleteTransaction`, `formatMoney, dayLabel, monthKey, todayStr` (format), `monthSummary` (model)

- [ ] **Step 1: Write `js/views/transactions.js`**

```js
import { h, monthPicker, swipeRow, iconBubble, emptyState } from "../ui.js";
import { formatMoney, dayLabel, monthKey } from "../format.js";
import { monthSummary } from "../model.js";
import { openTransactionSheet } from "./sheet-transaction.js";
import { deleteTransaction } from "../actions.js";

export function renderTransactions(el, ctx) {
  const { store, ui } = ctx;
  const state = store.getState();
  const catById = id => state.categories.find(c => c.id === id);
  const accName = id => state.accounts.find(a => a.id === id)?.name || "¿?";
  const rerender = () => { el.innerHTML = ""; renderTransactions(el, ctx); };

  const txs = state.transactions
    .filter(t => monthKey(t.date) === ui.month)
    .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
  const summary = monthSummary(state, ui.month);

  const row = t => {
    const isTransfer = t.type === "transfer";
    const cat = catById(t.categoryId);
    const icon = isTransfer ? iconBubble("⇄", "var(--text-3)", 40) : iconBubble(cat?.icon ?? "•", cat?.color ?? "#999", 40);
    const title = isTransfer ? `${accName(t.accountId)} → ${accName(t.toAccountId)}` : cat?.name ?? "Sin categoría";
    const sub = [isTransfer ? null : accName(t.accountId), t.note].filter(Boolean).join(" · ");
    const badge = t.source === "recurring" ? "Recurrente" : t.source === "interest" ? "Interés" : null;
    const cls = t.type === "expense" ? "neg" : t.type === "income" ? "pos" : "";
    const content = h("div", { class: "row tappable", onClick: () => openTransactionSheet({ store, tx: t }) },
      icon,
      h("div", { class: "row-main" },
        h("div", { class: "row-title" }, title, badge && h("span", { class: "badge" }, badge)),
        sub && h("div", { class: "row-sub" }, sub)),
      h("div", { class: "row-amount " + cls }, formatMoney(t.type === "expense" ? -t.amount : t.amount, { sign: t.type === "income" })));
    return swipeRow(content, () => { if (confirm("¿Borrar este movimiento?")) deleteTransaction(store, t.id); });
  };

  const groups = [];
  for (const t of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t); else groups.push({ date: t.date, items: [t] });
  }

  el.append(
    h("header", { class: "page-header" }, h("h1", null, "Movimientos")),
    monthPicker(ui.month, m => { ui.month = m; rerender(); }),
    h("div", { class: "card" }, h("div", { class: "stat-grid" },
      h("div", null, h("div", { class: "v pos" }, formatMoney(summary.income)), h("div", { class: "l" }, "Ingresos")),
      h("div", null, h("div", { class: "v neg" }, formatMoney(summary.expense)), h("div", { class: "l" }, "Gastos")),
      h("div", null, h("div", { class: "v" }, formatMoney(summary.savings)), h("div", { class: "l" }, "Ahorrado")))),
    txs.length === 0
      ? emptyState("No hay movimientos este mes. Pulsa + para añadir uno.")
      : groups.map(g => [
          h("div", { class: "group-header" }, dayLabel(g.date)),
          h("div", { class: "card list" }, g.items.map(row)),
        ]),
    h("button", { class: "fab", type: "button", "aria-label": "Añadir movimiento", onClick: () => openTransactionSheet({ store }) }, "+"));
}
```

- [ ] **Step 2: Verify**

Run: `bash tests/smoke.sh transactions "No hay movimientos" && bash tests/run-tests.sh`
Expected: `SMOKE OK` and `TESTS: 42 passed, 0 failed`. Manually in Edge: add two expenses on different days and one transfer; check grouping by day, colours, and that tapping a row opens the editor with the values filled in. In Edge DevTools device mode (touch emulation), swipe a row left and delete it.

- [ ] **Step 3: Commit**

```bash
git add js/views/transactions.js
git commit -m "feat: lista de movimientos por mes con edición y borrado

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 9: Statistics view

**Files:**
- Modify (replace placeholder): `js/views/stats.js`

**Interfaces:**
- Produces: `renderStats(el, {store, ui})` using `ui.statsMonth`, `ui.statsCategory` (category id or null), `ui.statsBar` (selected month index 0..11)
- Consumes: `donutChart, barChart, lineChart` (charts), `expensesByCategory, monthSeries, netWorthSeries, categorySeries` (model), `monthPicker, h, iconBubble, emptyState` (ui), `formatMoney, shortMonthLabel, monthLabel, capitalize` (format)

- [ ] **Step 1: Write `js/views/stats.js`**

```js
import { h, monthPicker, iconBubble, emptyState } from "../ui.js";
import { donutChart, barChart, lineChart } from "../charts.js";
import { formatMoney, shortMonthLabel, monthLabel, capitalize } from "../format.js";
import { expensesByCategory, monthSeries, netWorthSeries, categorySeries } from "../model.js";

export function renderStats(el, ctx) {
  const { store, ui } = ctx;
  const state = store.getState();
  const ym = ui.statsMonth;
  const catById = id => state.categories.find(c => c.id === id);
  const rerender = () => { el.innerHTML = ""; renderStats(el, ctx); };

  el.append(
    h("header", { class: "page-header" }, h("h1", null, "Estadísticas")),
    monthPicker(ym, m => { ui.statsMonth = m; ui.statsCategory = null; ui.statsBar = 11; rerender(); }));

  el.append(ui.statsCategory ? categoryCard() : donutCard());
  el.append(barsCard(), netWorthCard());

  function donutCard() {
    const rows = expensesByCategory(state, ym);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const slices = rows.map(r => { const c = catById(r.categoryId); return { id: r.categoryId, label: c?.name ?? "Otros", value: r.amount, color: c?.color ?? "#999" }; });
    const select = id => { ui.statsCategory = id; rerender(); };
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Gastos por categoría"),
      h("div", { class: "chart-wrap" }, donutChart({ slices, centerTop: formatMoney(total), centerBottom: capitalize(monthLabel(ym)), onSelect: select })),
      rows.length === 0 ? emptyState("Sin gastos este mes") : h("div", { class: "legend" }, slices.map(s =>
        h("div", { class: "legend-row", onClick: () => select(s.id) },
          h("span", { class: "legend-dot", style: { background: s.color } }),
          h("span", { class: "legend-name" }, s.label),
          h("span", { class: "num" }, formatMoney(s.value)),
          h("span", { class: "legend-pct" }, `${Math.round(100 * s.value / total)} %`)))));
  }

  function categoryCard() {
    const cat = catById(ui.statsCategory);
    const series = categorySeries(state, ui.statsCategory, ym, 12);
    const total = series.reduce((s, x) => s + x.amount, 0);
    const average = Math.round(total / 12);
    return h("section", { class: "card" },
      h("button", { type: "button", class: "settings-back", onClick: () => { ui.statsCategory = null; rerender(); } }, "‹ Categorías"),
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px", margin: "8px 0 12px" } },
        iconBubble(cat?.icon ?? "•", cat?.color ?? "#999", 36),
        h("div", null, h("div", { class: "bold" }, cat?.name ?? "Categoría"), h("div", { class: "small muted" }, "Últimos 12 meses"))),
      h("div", { class: "chart-wrap" }, barChart({
        groups: series.map(s => ({ label: shortMonthLabel(s.ym), values: [s.amount] })),
        series: [{ name: cat?.name ?? "", color: cat?.color ?? "#999" }],
        average,
      })),
      h("div", { class: "stat-grid" },
        h("div", null, h("div", { class: "v" }, formatMoney(total)), h("div", { class: "l" }, "Total 12 meses")),
        h("div", null, h("div", { class: "v" }, formatMoney(average)), h("div", { class: "l" }, "Media mensual")),
        h("div", null, h("div", { class: "v" }, formatMoney(series[11].amount)), h("div", { class: "l" }, capitalize(shortMonthLabel(ym))))));
  }

  function barsCard() {
    const series = monthSeries(state, ym, 12);
    const idx = Math.min(11, Math.max(0, ui.statsBar ?? 11));
    const sel = series[idx];
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Ingresos, gastos y ahorro"),
      h("div", { class: "chart-wrap" }, barChart({
        groups: series.map(s => ({ label: shortMonthLabel(s.ym), values: [s.income, s.expense, Math.max(0, s.savings)] })),
        series: [{ name: "Ingresos", color: "var(--green)" }, { name: "Gastos", color: "var(--red)" }, { name: "Ahorro", color: "var(--accent)" }],
        selectedIndex: idx,
        onSelect: i => { ui.statsBar = i; rerender(); },
      })),
      h("div", { class: "legend-inline" },
        h("span", { style: { "--dot": "var(--green)" } }, "Ingresos"),
        h("span", { style: { "--dot": "var(--red)" } }, "Gastos"),
        h("span", { style: { "--dot": "var(--accent)" } }, "Ahorro")),
      h("div", { class: "small muted", style: { marginTop: "10px" } }, capitalize(monthLabel(sel.ym))),
      h("div", { class: "stat-grid" },
        h("div", null, h("div", { class: "v pos" }, formatMoney(sel.income)), h("div", { class: "l" }, "Ingresos")),
        h("div", null, h("div", { class: "v neg" }, formatMoney(sel.expense)), h("div", { class: "l" }, "Gastos")),
        h("div", null, h("div", { class: "v" }, formatMoney(sel.savings)), h("div", { class: "l" }, "Ahorro"))));
  }

  function netWorthCard() {
    const series = netWorthSeries(state, ym);
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Evolución del patrimonio"),
      h("div", { class: "chart-wrap" }, lineChart({
        points: series.map(p => ({ label: `${shortMonthLabel(p.ym)} ${p.ym.slice(2, 4)}`, value: p.value })),
        format: formatMoney,
      })));
  }
}
```

- [ ] **Step 2: Verify**

Run: `bash tests/smoke.sh stats "Gastos por categoría" && bash tests/smoke.sh stats "Evolución del patrimonio" && bash tests/run-tests.sh`
Expected: two `SMOKE OK` and `TESTS: 42 passed, 0 failed`. Manually: with a few expenses in two categories, the donut shows two colours, tapping a legend row opens the 12‑month category view with the dashed average line, and the "‹ Categorías" button returns.

- [ ] **Step 3: Commit**

```bash
git add js/views/stats.js
git commit -m "feat: estadísticas con donut, barras mensuales y patrimonio

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 10: Settings view, management sheets and backup

**Files:**
- Modify (replace placeholder): `js/views/settings.js`
- Create: `js/views/settings-sheets.js`

**Interfaces:**
- Produces (`settings-sheets.js`): `openAccountSheet({store, account = null})`, `openCategorySheet({store, category = null})`, `openRecurringSheet({store, recurring = null})`
- Produces (`settings.js`): `renderSettings(el, {store, ui})` using `ui.settingsPage ∈ "root"|"accounts"|"categories"|"recurring"`
- Consumes: actions (`saveAccount, deleteAccount, saveCategory, deleteCategory, saveRecurring, deleteRecurring, addTransaction`), `exportJSON, parseImport, uid` (store), `initialLastPosted, categoryUsageCount, accountInUse` (model), ui helpers, `parseAmount, formatMoney, todayStr, pad2` (format)

Palette for colour pickers: `["#0a84ff","#30d158","#ff9f0a","#ff375f","#bf5af2","#64d2ff","#ffd60a","#ff453a","#5e5ce6","#f7931a","#8e8e93","#aeaeb2"]`.

- [ ] **Step 1: Write `js/views/settings-sheets.js`**

```js
import { h, openSheet, field, select, toast } from "../ui.js";
import { parseAmount, todayStr } from "../format.js";
import { initialLastPosted } from "../model.js";
import { uid } from "../store.js";
import { saveAccount, saveCategory, saveRecurring, addTransaction } from "../actions.js";

const PALETTE = ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f", "#bf5af2", "#64d2ff", "#ffd60a", "#ff453a", "#5e5ce6", "#f7931a", "#8e8e93", "#aeaeb2"];
const KINDS = [["bank", "Cuenta corriente"], ["savings", "Ahorro"], ["investment", "Inversión"], ["crypto", "Cripto"]];

function colorPicker(current, onPick) {
  const row = h("div", { class: "color-row" });
  const paint = () => {
    row.innerHTML = "";
    for (const c of PALETTE) {
      row.append(h("button", { type: "button", class: "color-dot" + (c === current ? " active" : ""), style: { background: c }, "aria-label": c, onClick: () => { current = c; onPick(c); paint(); } }));
    }
  };
  paint();
  return row;
}

function textInput(value, onInput, extra = {}) {
  return h("input", { class: "input", type: "text", value, onInput: e => onInput(e.target.value), ...extra });
}

export function openAccountSheet({ store, account = null }) {
  const form = account
    ? { ...account }
    : { id: uid(), name: "", kind: "bank", valuation: "ledger", initialBalance: 0, annualRate: 0, color: PALETTE[0], icon: "🏦" };
  let initialText = (form.initialBalance / 100).toFixed(2).replace(".", ",");
  let rateText = String(form.annualRate || 0).replace(".", ",");
  const body = h("div");
  render();

  function render() {
    body.innerHTML = "";
    body.append(
      field("Nombre", textInput(form.name, v => { form.name = v; }, { placeholder: "Nombre" })),
      field("Icono", textInput(form.icon, v => { form.icon = v; }, { maxlength: 2, style: { width: "60px", flex: "none" } })),
      field("Tipo", select(KINDS.map(([value, label]) => ({ value, label })), form.kind, v => { form.kind = v; })),
      field("Saldo", select([{ value: "ledger", label: "Por movimientos" }, { value: "manual", label: "Valor manual" }], form.valuation, v => { form.valuation = v; render(); })),
    );
    if (form.valuation === "ledger") {
      body.append(
        field("Saldo inicial (€)", textInput(initialText, v => { initialText = v; }, { inputmode: "decimal" })),
        field("Interés anual (%)", textInput(rateText, v => { rateText = v; }, { inputmode: "decimal" })));
    } else {
      body.append(h("p", { class: "small muted" }, "El saldo se fija actualizando el valor desde Inicio. Las transferencias hacia esta cuenta se suman hasta la siguiente actualización."));
    }
    body.append(field("Color", colorPicker(form.color, c => { form.color = c; })));
  }

  openSheet({
    title: account ? "Editar cuenta" : "Nueva cuenta",
    content: body,
    onSave() {
      form.name = form.name.trim();
      if (!form.name) { toast("Pon un nombre"); return false; }
      if (!form.icon.trim()) form.icon = "💳";
      if (form.valuation === "ledger") {
        const init = parseAmount(initialText.trim() === "" ? "0" : initialText);
        const rate = Number(rateText.replace(",", "."));
        if (init == null) { toast("Saldo inicial no válido"); return false; }
        if (!Number.isFinite(rate) || rate < 0) { toast("Interés no válido"); return false; }
        form.initialBalance = init; form.annualRate = rate;
      } else {
        form.initialBalance = 0; form.annualRate = 0;
      }
      saveAccount(store, form);
      return true;
    },
  });
}

export function openCategorySheet({ store, category = null }) {
  const form = category ? { ...category } : { id: uid(), name: "", color: PALETTE[2], icon: "🏷️" };
  const body = h("div",
    field("Nombre", textInput(form.name, v => { form.name = v; }, { placeholder: "Nombre" })),
    field("Icono", textInput(form.icon, v => { form.icon = v; }, { maxlength: 2, style: { width: "60px", flex: "none" } })),
    field("Color", colorPicker(form.color, c => { form.color = c; })));
  openSheet({
    title: category ? "Editar categoría" : "Nueva categoría",
    content: body,
    onSave() {
      form.name = form.name.trim();
      if (!form.name) { toast("Pon un nombre"); return false; }
      if (!form.icon.trim()) form.icon = "🏷️";
      saveCategory(store, form);
      return true;
    },
  });
}

export function openRecurringSheet({ store, recurring = null }) {
  const state = store.getState();
  const accounts = [...state.accounts].filter(a => a.valuation === "ledger").sort((a, b) => a.order - b.order);
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  const form = recurring
    ? { ...recurring }
    : { id: uid(), type: "expense", amount: 0, accountId: accounts.find(a => a.kind === "bank")?.id || accounts[0]?.id || "", categoryId: categories[0]?.id || "", note: "", dayOfMonth: 1, active: true, lastPosted: null };
  let amountText = recurring ? (recurring.amount / 100).toFixed(2).replace(".", ",") : "";
  const body = h("div");
  render();

  function render() {
    body.innerHTML = "";
    body.append(
      h("div", { class: "segmented" }, [["expense", "Gasto"], ["income", "Ingreso"]].map(([v, label]) =>
        h("button", { type: "button", class: v === form.type ? "active" : "", onClick: () => { form.type = v; render(); } }, label))),
      field("Nombre", textInput(form.note, v => { form.note = v; }, { placeholder: "Alquiler, nómina…" })),
      field("Importe (€)", textInput(amountText, v => { amountText = v; }, { inputmode: "decimal", placeholder: "0,00" })),
      field("Cuenta", select(accounts.map(a => ({ value: a.id, label: a.name })), form.accountId, v => { form.accountId = v; })),
      field("Categoría", select(categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })), form.categoryId, v => { form.categoryId = v; })),
      field("Día del mes", select(Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(form.dayOfMonth), v => { form.dayOfMonth = Number(v); })),
      field("Activo", h("button", { type: "button", class: "switch" + (form.active ? " on" : ""), "aria-label": "Activo", onClick: () => { form.active = !form.active; render(); } })));
  }

  openSheet({
    title: recurring ? "Editar recurrente" : "Nuevo recurrente",
    content: body,
    onSave() {
      const amount = parseAmount(amountText);
      if (amount == null || amount <= 0) { toast("El importe debe ser mayor que cero"); return false; }
      if (!form.accountId) { toast("Elige una cuenta"); return false; }
      if (!form.categoryId) { toast("Elige una categoría"); return false; }
      form.amount = amount;
      form.note = form.note.trim();
      const today = todayStr();
      if (!recurring) {
        form.lastPosted = initialLastPosted(form.dayOfMonth, today);
        const alreadyDue = form.lastPosted === today.slice(0, 7);
        saveRecurring(store, form);
        if (alreadyDue && confirm("El día de este mes ya ha pasado. ¿Registrar también el movimiento de este mes?")) {
          const date = `${today.slice(0, 7)}-${String(form.dayOfMonth).padStart(2, "0")}`;
          addTransaction(store, { id: uid(), type: form.type, amount, date, accountId: form.accountId, categoryId: form.categoryId, note: form.note, source: "recurring", recurringId: form.id });
        }
      } else {
        saveRecurring(store, form);
      }
      return true;
    },
  });
}
```

- [ ] **Step 2: Write `js/views/settings.js`**

```js
import { h, iconBubble, swipeRow, toast, emptyState } from "../ui.js";
import { formatMoney, todayStr } from "../format.js";
import { accountInUse, categoryUsageCount } from "../model.js";
import { exportJSON, parseImport } from "../store.js";
import { deleteAccount, deleteCategory, deleteRecurring } from "../actions.js";
import { openAccountSheet, openCategorySheet, openRecurringSheet } from "./settings-sheets.js";

const APP_VERSION = "1.0.0";

export function renderSettings(el, ctx) {
  const { store, ui } = ctx;
  const state = store.getState();
  const rerender = () => { el.innerHTML = ""; renderSettings(el, ctx); };
  const goto = page => { ui.settingsPage = page; window.scrollTo(0, 0); rerender(); };
  const pages = { root, accounts, categories, recurring };
  (pages[ui.settingsPage] || root)();

  function navRow(title, sub, onClick) {
    return h("div", { class: "row tappable", onClick },
      h("div", { class: "row-main" }, h("div", { class: "row-title" }, title), sub && h("div", { class: "row-sub" }, sub)),
      h("span", { class: "chevron" }, "›"));
  }

  function subHeader(title) {
    return [
      h("button", { type: "button", class: "settings-back", onClick: () => goto("root") }, "‹ Ajustes"),
      h("header", { class: "page-header" }, h("h1", null, title)),
    ];
  }

  function root() {
    el.append(
      h("header", { class: "page-header" }, h("h1", null, "Ajustes")),
      store.corrupt && h("div", { class: "warning" }, "Los datos guardados no se pudieron leer y se ha empezado de cero. El contenido original se conserva en el navegador; importa una copia de seguridad si tienes una."),
      h("div", { class: "card list" },
        navRow("Cuentas", `${state.accounts.length} cuentas`, () => goto("accounts")),
        navRow("Categorías", `${state.categories.length} categorías`, () => goto("categories")),
        navRow("Movimientos recurrentes", `${state.recurring.length} configurados`, () => goto("recurring"))),
      h("div", { class: "section-title" }, "Copia de seguridad"),
      h("div", { class: "card list" },
        navRow("Exportar datos", "Guarda un archivo JSON con todo", exportBackup),
        navRow("Importar datos", "Reemplaza los datos con un archivo JSON", importBackup)),
      h("div", { class: "section-title" }, "Información"),
      h("div", { class: "card list" },
        h("div", { class: "row" }, h("div", { class: "row-main" }, h("div", { class: "row-title" }, "Versión")), h("div", { class: "muted" }, APP_VERSION))));
  }

  function accounts() {
    el.append(...subHeader("Cuentas"),
      h("div", { class: "card list" }, [...state.accounts].sort((a, b) => a.order - b.order).map(acc => {
        const content = h("div", { class: "row tappable", onClick: () => openAccountSheet({ store, account: acc }) },
          iconBubble(acc.icon, acc.color, 40),
          h("div", { class: "row-main" },
            h("div", { class: "row-title" }, acc.name),
            h("div", { class: "row-sub" }, acc.valuation === "manual" ? "Valor manual" : `Saldo inicial ${formatMoney(acc.initialBalance)}${acc.annualRate > 0 ? ` · ${String(acc.annualRate).replace(".", ",")} % anual` : ""}`)),
          h("span", { class: "chevron" }, "›"));
        return swipeRow(content, () => {
          if (accountInUse(state, acc.id)) { toast("No se puede borrar: la cuenta tiene movimientos"); return; }
          if (confirm(`¿Borrar la cuenta "${acc.name}"?`)) deleteAccount(store, acc.id);
        });
      })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openAccountSheet({ store }) }, "+ Añadir cuenta"));
  }

  function categories() {
    el.append(...subHeader("Categorías"),
      h("div", { class: "card list" }, [...state.categories].sort((a, b) => a.order - b.order).map(cat => {
        const uses = categoryUsageCount(state, cat.id);
        const content = h("div", { class: "row tappable", onClick: () => openCategorySheet({ store, category: cat }) },
          iconBubble(cat.icon, cat.color, 40),
          h("div", { class: "row-main" },
            h("div", { class: "row-title" }, cat.name, cat.system && h("span", { class: "badge" }, "Sistema")),
            h("div", { class: "row-sub" }, uses === 1 ? "1 movimiento" : `${uses} movimientos`)),
          h("span", { class: "chevron" }, "›"));
        return swipeRow(content, () => {
          if (cat.system) { toast("Las categorías de sistema no se pueden borrar"); return; }
          const msg = uses > 0 ? `"${cat.name}" tiene ${uses} movimientos. Se moverán a "Otros". ¿Borrar?` : `¿Borrar la categoría "${cat.name}"?`;
          if (confirm(msg)) deleteCategory(store, cat.id);
        });
      })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openCategorySheet({ store }) }, "+ Añadir categoría"));
  }

  function recurring() {
    const accName = id => state.accounts.find(a => a.id === id)?.name || "¿?";
    const cat = id => state.categories.find(c => c.id === id);
    el.append(...subHeader("Recurrentes"),
      state.recurring.length === 0
        ? emptyState("Sin movimientos recurrentes. Añade la nómina, el alquiler o cualquier gasto fijo.")
        : h("div", { class: "card list" }, state.recurring.map(r => {
            const c = cat(r.categoryId);
            const content = h("div", { class: "row tappable", onClick: () => openRecurringSheet({ store, recurring: r }) },
              iconBubble(c?.icon ?? "•", c?.color ?? "#999", 40),
              h("div", { class: "row-main" },
                h("div", { class: "row-title" }, r.note || c?.name || "Recurrente", !r.active && h("span", { class: "badge" }, "Pausado")),
                h("div", { class: "row-sub" }, `Día ${r.dayOfMonth} · ${accName(r.accountId)}`)),
              h("div", { class: "row-amount " + (r.type === "expense" ? "neg" : "pos") }, formatMoney(r.type === "expense" ? -r.amount : r.amount, { sign: r.type === "income" })));
            return swipeRow(content, () => { if (confirm("¿Borrar este recurrente? Los movimientos ya registrados se conservan.")) deleteRecurring(store, r.id); });
          })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openRecurringSheet({ store }) }, "+ Añadir recurrente"));
  }

  async function exportBackup() {
    const name = `finanzas-${todayStr()}.json`;
    const blob = new Blob([exportJSON(store.getState())], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Copia de seguridad Finanzas" });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    toast("Archivo descargado");
  }

  function importBackup() {
    const input = h("input", { type: "file", accept: "application/json,.json", style: { display: "none" } });
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) return;
      try {
        const data = parseImport(await f.text());
        if (!confirm(`Se reemplazarán todos los datos actuales por ${data.transactions.length} movimientos y ${data.accounts.length} cuentas. ¿Continuar?`)) return;
        store.replace(data);
        toast("Datos importados");
      } catch (err) {
        toast(`No se pudo importar: ${err.message}`);
      }
    });
    document.body.append(input);
    input.click();
  }
}
```

- [ ] **Step 3: Verify**

Run: `bash tests/smoke.sh settings "Copia de seguridad" && bash tests/run-tests.sh`
Expected: `SMOKE OK` and `TESTS: 42 passed, 0 failed`. Manually in Edge: create a category "Mascotas", edit Trade Republic's rate to `2,5`, add a recurring "Alquiler" day 1 (accept posting this month) and check it appears in Movimientos with the "Recurrente" badge. Export, then import the same file and confirm nothing is lost.

- [ ] **Step 4: Commit**

```bash
git add js/views
git commit -m "feat: ajustes de cuentas, categorías, recurrentes y copia de seguridad

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

### Task 11: PWA packaging, icons and deployment guide

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `tools/make-icons.ps1`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `README.md`

- [ ] **Step 1: Write `manifest.webmanifest`**

```json
{
  "name": "Finanzas",
  "short_name": "Finanzas",
  "description": "Ingresos, gastos y ahorro",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#0a84ff",
  "lang": "es",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Write `sw.js`**

Bump `CACHE` on every publish (see README).
```js
const CACHE = "finanzas-v1";
const ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/base.css", "./css/components.css",
  "./js/app.js", "./js/store.js", "./js/actions.js", "./js/model.js", "./js/format.js", "./js/ui.js", "./js/charts.js",
  "./js/views/home.js", "./js/views/transactions.js", "./js/views/stats.js", "./js/views/settings.js",
  "./js/views/sheet-transaction.js", "./js/views/sheet-valuation.js", "./js/views/settings-sheets.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request).then(res => {
      if (res.ok && new URL(event.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy));
      }
      return res;
    })));
});
```

- [ ] **Step 3: Write `tools/make-icons.ps1` and generate icons**

```powershell
# Generates PNG icons for the PWA using System.Drawing (no external tools).
Add-Type -AssemblyName System.Drawing

function New-AppIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 132, 255))
  $font = New-Object System.Drawing.Font("Segoe UI", [int]($size * 0.6), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF 0, ($size * 0.02), $size, $size
  $g.DrawString([string][char]0x20AC, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$out = Join-Path $PSScriptRoot "..\icons"
New-Item -ItemType Directory -Force $out | Out-Null
New-AppIcon 192 (Join-Path $out "icon-192.png")
New-AppIcon 512 (Join-Path $out "icon-512.png")
New-AppIcon 180 (Join-Path $out "apple-touch-icon.png")
Write-Output "Iconos generados en $out"
```

Run (PowerShell): `powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1`
Expected: `Iconos generados en ...` and three PNG files in `icons/`. Verify with `ls icons` and by opening one with the Read tool (it renders images).

- [ ] **Step 4: Write `README.md`**

````markdown
# Finanzas

App web instalable (PWA) para apuntar ingresos, gastos, ahorro y cuentas, con diseño estilo iOS. Sin servidor: los datos se guardan en el propio teléfono.

## Publicar en GitHub Pages

1. Crea un repositorio en https://github.com/new (por ejemplo `finanzas`), público, sin README.
2. En este ordenador, dentro de la carpeta del proyecto:
   ```
   git remote add origin https://github.com/TU_USUARIO/finanzas.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. Al cabo de un minuto la app está en `https://TU_USUARIO.github.io/finanzas/`.

## Instalar en el iPhone

1. Abre esa URL en **Safari** (tiene que ser Safari, no Chrome).
2. Pulsa el botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre "Finanzas" desde el icono. Se abre a pantalla completa y funciona sin conexión.

## Actualizar la app

1. Cambia el número de versión en `sw.js` (`finanzas-v1` → `finanzas-v2`, etc.). Sin esto el iPhone seguirá mostrando la versión antigua.
2. `git add -A && git commit -m "..." && git push`.
3. En el iPhone, cierra la app del todo y ábrela dos veces: la primera descarga la versión nueva, la segunda ya la usa.

## Copias de seguridad

Ajustes → Exportar datos guarda un archivo JSON (por ejemplo en Archivos o iCloud Drive). Importar datos lo restaura. Los datos viven solo en el navegador del teléfono: si borras los datos de Safari o cambias de móvil, necesitarás esa copia.

## Desarrollo

- Sin dependencias. Abre `index.html` en un navegador para probar.
- Tests: abre `tests/tests.html`, o ejecuta `bash tests/run-tests.sh` (usa Microsoft Edge en modo headless).
- Iconos: `powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1`.
````

- [ ] **Step 5: Verify the whole app once more**

Run: `bash tests/run-tests.sh && bash tests/smoke.sh home "Patrimonio total" && bash tests/smoke.sh transactions "Movimientos" && bash tests/smoke.sh stats "Gastos por categoría" && bash tests/smoke.sh settings "Copia de seguridad" && ls icons`
Expected: `TESTS: 42 passed, 0 failed`, four `SMOKE OK` lines, three PNG files listed.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js tools icons README.md
git commit -m "feat: manifest, service worker, iconos y guía de despliegue

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoN7eC29X3wSeVQJUex5ZL"
```

---

## After the plan: user steps

These need the user's GitHub account and iPhone and cannot be done by an agent:
1. Create the GitHub repository and push (`README.md` §Publicar).
2. Enable GitHub Pages.
3. Open the URL in Safari on the iPhone and add to the home screen.
4. Check on the phone: dark/light theme, safe areas, offline launch (airplane mode), export via share sheet.
