import { test, assertEqual, assertTrue } from "./runner.js";
import { parseImport, createStore, postAutomatic } from "../js/store.js";
import { accountBalance, monthSummary } from "../js/model.js";

async function loadPublished() {
  const res = await fetch("../datos/inicio-2026-09.json");
  return parseImport(await res.text());
}

test("datos/inicio-2026-09.json es importable y conserva todos los movimientos", async () => {
  const data = await loadPublished();
  assertEqual(data.accounts.length, 5);
  assertEqual(data.transactions.length, 20);
  assertEqual(data.recurring.length, 3);
  const raw = JSON.parse(await (await fetch("../datos/inicio-2026-09.json")).text());
  assertEqual(data.transactions.length, raw.transactions.length, "migrate descartó movimientos");
});

test("datos publicados: saldos 689 € - 141,05 € en banco y 1.000 € en ahorro", async () => {
  const data = await loadPublished();
  assertEqual(accountBalance(data, "acc-banco"), 68900 - 14105);
  assertEqual(accountBalance(data, "acc-ahorro"), 100000);
  assertEqual(monthSummary(data, "2026-08"), { income: 159400, expense: 5145, savings: 100000 });
  assertEqual(monthSummary(data, "2026-09").expense, 8960);
});

test("datos publicados: al abrir en septiembre se registran los 3 pagos mensuales", async () => {
  const data = await loadPublished();
  const map = new Map([["finanzas.v1", JSON.stringify(data)]]);
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  const store = createStore({ storage, today: () => "2026-09-07" });
  postAutomatic(store, "2026-09-07");
  const s = store.getState();
  const rec = s.transactions.filter(t => t.source === "recurring");
  assertEqual(rec.map(t => [t.date, t.amount]), [["2026-09-01", 350], ["2026-09-01", 1500], ["2026-09-01", 599]]);
  assertTrue(s.recurring.every(r => r.lastPosted === "2026-09"));
  assertEqual(accountBalance(s, "acc-banco"), 68900 - 14105 - 2449);
});
