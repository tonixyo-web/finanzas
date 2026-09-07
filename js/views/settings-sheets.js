import { h, openSheet, field, select, toast } from "../ui.js";
import { parseAmount, todayStr } from "../format.js";
import { initialLastPosted } from "../model.js";
import { uid } from "../store.js";
import { saveAccount, saveCategory, saveRecurring, addTransaction } from "../actions.js";

const PALETTE = ["#0a84ff", "#30d158", "#ff9f0a", "#ff375f", "#bf5af2", "#64d2ff", "#ffd60a", "#ff453a", "#5e5ce6", "#f7931a", "#8e8e93", "#aeaeb2"];
const KINDS = [["bank", "Cuenta corriente"], ["savings", "Ahorro"], ["investment", "Inversión"], ["crypto", "Cripto"]];

function colorPicker(current, onPick) {
  const row = h("div", { class: "color-row" });
  const paint = () => {
    row.innerHTML = "";
    for (const c of PALETTE) {
      row.append(h("button", { type: "button", class: "color-dot" + (c === current ? " active" : ""), style: { background: c }, "aria-label": c, onClick: () => { current = c; onPick(c); paint(); } }));
    }
  };
  paint();
  return row;
}

function textInput(value, onInput, extra = {}) {
  return h("input", { class: "input", type: "text", value, onInput: e => onInput(e.target.value), ...extra });
}

export function openAccountSheet({ store, account = null }) {
  const form = account
    ? { ...account }
    : { id: uid(), name: "", kind: "bank", valuation: "ledger", initialBalance: 0, annualRate: 0, color: PALETTE[0], icon: "🏦" };
  let initialText = (form.initialBalance / 100).toFixed(2).replace(".", ",");
  let rateText = String(form.annualRate || 0).replace(".", ",");
  const body = h("div");
  render();

  function render() {
    body.innerHTML = "";
    body.append(
      field("Nombre", textInput(form.name, v => { form.name = v; }, { placeholder: "Nombre" })),
      field("Icono", textInput(form.icon, v => { form.icon = v; }, { maxlength: 2, style: { width: "60px", flex: "none" } })),
      field("Tipo", select(KINDS.map(([value, label]) => ({ value, label })), form.kind, v => { form.kind = v; })),
      field("Saldo", select([{ value: "ledger", label: "Por movimientos" }, { value: "manual", label: "Valor manual" }], form.valuation, v => { form.valuation = v; render(); })),
    );
    if (form.valuation === "ledger") {
      body.append(
        field("Saldo inicial (€)", textInput(initialText, v => { initialText = v; }, { inputmode: "decimal" })),
        field("Interés anual (%)", textInput(rateText, v => { rateText = v; }, { inputmode: "decimal" })));
    } else {
      body.append(h("p", { class: "small muted" }, "El saldo se fija actualizando el valor desde Inicio. Las transferencias hacia esta cuenta se suman hasta la siguiente actualización."));
    }
    body.append(field("Color", colorPicker(form.color, c => { form.color = c; })));
  }

  openSheet({
    title: account ? "Editar cuenta" : "Nueva cuenta",
    content: body,
    onSave() {
      form.name = form.name.trim();
      if (!form.name) { toast("Pon un nombre"); return false; }
      if (!form.icon.trim()) form.icon = "💳";
      if (form.valuation === "ledger") {
        const init = parseAmount(initialText.trim() === "" ? "0" : initialText);
        const rate = Number(rateText.replace(",", "."));
        if (init == null) { toast("Saldo inicial no válido"); return false; }
        if (!Number.isFinite(rate) || rate < 0) { toast("Interés no válido"); return false; }
        form.initialBalance = init; form.annualRate = rate;
      } else {
        form.initialBalance = 0; form.annualRate = 0;
      }
      saveAccount(store, form);
      return true;
    },
  });
}

export function openCategorySheet({ store, category = null }) {
  const form = category ? { ...category } : { id: uid(), name: "", color: PALETTE[2], icon: "🏷️" };
  const body = h("div", {},
    field("Nombre", textInput(form.name, v => { form.name = v; }, { placeholder: "Nombre" })),
    field("Icono", textInput(form.icon, v => { form.icon = v; }, { maxlength: 2, style: { width: "60px", flex: "none" } })),
    field("Color", colorPicker(form.color, c => { form.color = c; })));
  openSheet({
    title: category ? "Editar categoría" : "Nueva categoría",
    content: body,
    onSave() {
      form.name = form.name.trim();
      if (!form.name) { toast("Pon un nombre"); return false; }
      if (!form.icon.trim()) form.icon = "🏷️";
      saveCategory(store, form);
      return true;
    },
  });
}

export function openRecurringSheet({ store, recurring = null }) {
  const state = store.getState();
  const accounts = [...state.accounts].filter(a => a.valuation === "ledger").sort((a, b) => a.order - b.order);
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  const form = recurring
    ? { ...recurring }
    : { id: uid(), type: "expense", amount: 0, accountId: accounts.find(a => a.kind === "bank")?.id || accounts[0]?.id || "", categoryId: categories[0]?.id || "", note: "", dayOfMonth: 1, active: true, lastPosted: null };
  let amountText = recurring ? (recurring.amount / 100).toFixed(2).replace(".", ",") : "";
  const body = h("div");
  render();

  function render() {
    body.innerHTML = "";
    body.append(
      h("div", { class: "segmented" }, [["expense", "Gasto"], ["income", "Ingreso"]].map(([v, label]) =>
        h("button", { type: "button", class: v === form.type ? "active" : "", onClick: () => { form.type = v; render(); } }, label))),
      field("Nombre", textInput(form.note, v => { form.note = v; }, { placeholder: "Alquiler, nómina…" })),
      field("Importe (€)", textInput(amountText, v => { amountText = v; }, { inputmode: "decimal", placeholder: "0,00" })),
      field("Cuenta", select(accounts.map(a => ({ value: a.id, label: a.name })), form.accountId, v => { form.accountId = v; })),
      field("Categoría", select(categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })), form.categoryId, v => { form.categoryId = v; })),
      field("Día del mes", select(Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), String(form.dayOfMonth), v => { form.dayOfMonth = Number(v); })),
      field("Activo", h("button", { type: "button", class: "switch" + (form.active ? " on" : ""), "aria-label": "Activo", onClick: () => { form.active = !form.active; render(); } })));
  }

  openSheet({
    title: recurring ? "Editar recurrente" : "Nuevo recurrente",
    content: body,
    onSave() {
      const amount = parseAmount(amountText);
      if (amount == null || amount <= 0) { toast("El importe debe ser mayor que cero"); return false; }
      if (!form.accountId) { toast("Elige una cuenta"); return false; }
      if (!form.categoryId) { toast("Elige una categoría"); return false; }
      form.amount = amount;
      form.note = form.note.trim();
      const today = todayStr();
      if (!recurring) {
        form.lastPosted = initialLastPosted(form.dayOfMonth, today);
        const alreadyDue = form.lastPosted === today.slice(0, 7);
        saveRecurring(store, form);
        if (alreadyDue && confirm("El día de este mes ya ha pasado. ¿Registrar también el movimiento de este mes?")) {
          const date = `${today.slice(0, 7)}-${String(form.dayOfMonth).padStart(2, "0")}`;
          addTransaction(store, { id: uid(), type: form.type, amount, date, accountId: form.accountId, categoryId: form.categoryId, note: form.note, source: "recurring", recurringId: form.id });
        }
      } else {
        saveRecurring(store, form);
      }
      return true;
    },
  });
}
