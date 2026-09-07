import { monthKey, addMonths, lastDayOfMonth, monthRange, pad2 } from "./format.js";

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
