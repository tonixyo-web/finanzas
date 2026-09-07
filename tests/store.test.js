import { test, assertEqual, assertThrows, assertTrue } from "./runner.js";
import { createStore, defaultState, migrate, postAutomatic, exportJSON, parseImport, STORAGE_KEY } from "../js/store.js";
import { monthKey, todayStr } from "../js/format.js";
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

test("migrate descarta movimientos inválidos y conserva los válidos", () => {
  const data = {
    schemaVersion: 1,
    accounts: [{ id: "a1" }],
    categories: [{ id: "c1" }],
    transactions: [
      { id: "t1", type: "expense", amount: 100, accountId: "a1", categoryId: "c1" },
      { id: "t2", type: "expense", amount: 100, date: "2026-09-07", accountId: "a1", categoryId: "c1" },
      null,
      { id: "t3", type: "bogus", amount: 100, date: "2026-09-07", accountId: "a1" },
    ],
  };
  const m = migrate(data);
  assertEqual(m.transactions.length, 1);
  assertEqual(m.transactions[0].id, "t2");
});

test("migrate repara recurrentes sin lastPosted y con dayOfMonth fuera de rango", () => {
  const data = {
    schemaVersion: 1,
    accounts: [], categories: [], transactions: [],
    recurring: [{ id: "r1", type: "expense", amount: 500, accountId: "a1", categoryId: "c1", dayOfMonth: 40 }],
  };
  const m = migrate(data);
  assertEqual(m.recurring.length, 1);
  assertEqual(m.recurring[0].dayOfMonth, 28);
  assertEqual(m.recurring[0].active, true);
  assertTrue(/^\d{4}-\d{2}$/.test(m.recurring[0].lastPosted));
  assertEqual(m.recurring[0].lastPosted, monthKey(todayStr()));
});

test("store.replace admite datos basura sin lanzar y postAutomatic sigue funcionando", () => {
  const store = createStore({ storage: fakeStorage(), today: TODAY });
  const garbage = {
    schemaVersion: 1,
    accounts: [{ id: "a1" }, null, "no-es-una-cuenta"],
    categories: [{ id: "c1" }],
    transactions: [
      { id: "t1", type: "expense", amount: 100, accountId: "a1", categoryId: "c1" },
      null,
    ],
    recurring: [{ id: "r1", type: "expense", amount: 500, accountId: "a1", categoryId: "c1", dayOfMonth: 40, active: true }],
  };
  store.replace(garbage);
  assertEqual(store.getState().transactions.length, 0);
  assertEqual(store.getState().accounts.length, 1);
  postAutomatic(store, TODAY());
  assertTrue(/^\d{4}-\d{2}$/.test(store.getState().recurring[0].lastPosted));
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
