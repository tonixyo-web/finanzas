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
