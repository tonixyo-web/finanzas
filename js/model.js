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
