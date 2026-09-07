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
