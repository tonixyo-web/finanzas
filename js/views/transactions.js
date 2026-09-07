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
    ...(txs.length === 0
      ? [emptyState("No hay movimientos este mes. Pulsa + para añadir uno.")]
      : groups.flatMap(g => [
          h("div", { class: "group-header" }, dayLabel(g.date)),
          h("div", { class: "card list" }, g.items.map(row)),
        ])),
    h("button", { class: "fab", type: "button", "aria-label": "Añadir movimiento", onClick: () => openTransactionSheet({ store }) }, "+"));
}
