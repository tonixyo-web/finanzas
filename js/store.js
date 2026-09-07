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
