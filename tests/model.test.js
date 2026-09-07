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
