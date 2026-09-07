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
