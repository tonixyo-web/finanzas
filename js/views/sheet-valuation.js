import { h, openSheet, field, toast } from "../ui.js";
import { parseAmount, todayStr, formatMoney } from "../format.js";
import { accountBalance } from "../model.js";
import { uid } from "../store.js";
import { addValuation } from "../actions.js";

export function openValuationSheet({ store, account }) {
  const current = accountBalance(store.getState(), account.id);
  let valueText = (current / 100).toFixed(2).replace(".", ",");
  let date = todayStr();
  const body = h("div", {},
    h("p", { class: "muted small" }, `Valor actual de ${account.name}: ${formatMoney(current)}. Introduce el valor total que muestra la app de ${account.name} hoy.`),
    h("div", { class: "amount-wrap" },
      h("input", { class: "amount-input", inputmode: "decimal", value: valueText, onInput: e => { valueText = e.target.value; } }),
      h("span", { class: "amount-cur" }, "€")),
    field("Fecha", h("input", { class: "input", type: "date", value: date, onInput: e => { date = e.target.value; } })));
  openSheet({
    title: "Actualizar valor",
    content: body,
    onSave() {
      const value = parseAmount(valueText);
      if (value == null) { toast("Introduce un valor válido"); return false; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Fecha no válida"); return false; }
      addValuation(store, { id: uid(), accountId: account.id, date, value });
      toast("Valor actualizado");
      return true;
    },
  });
}
