import { h, iconBubble, swipeRow, toast, emptyState } from "../ui.js";
import { formatMoney, todayStr } from "../format.js";
import { accountInUse, categoryUsageCount } from "../model.js";
import { exportJSON, parseImport } from "../store.js";
import { deleteAccount, deleteCategory, deleteRecurring } from "../actions.js";
import { openAccountSheet, openCategorySheet, openRecurringSheet } from "./settings-sheets.js";

const APP_VERSION = "1.0.0";

let importInput = null;

export function renderSettings(el, ctx) {
  const { store, ui } = ctx;
  const state = store.getState();
  const rerender = () => { el.innerHTML = ""; renderSettings(el, ctx); };
  const goto = page => { ui.settingsPage = page; window.scrollTo(0, 0); rerender(); };
  const pages = { root, accounts, categories, recurring };
  (pages[ui.settingsPage] || root)();

  function navRow(title, sub, onClick) {
    return h("div", { class: "row tappable", onClick },
      h("div", { class: "row-main" }, h("div", { class: "row-title" }, title), sub && h("div", { class: "row-sub" }, sub)),
      h("span", { class: "chevron" }, "›"));
  }

  function subHeader(title) {
    return [
      h("button", { type: "button", class: "settings-back", onClick: () => goto("root") }, "‹ Ajustes"),
      h("header", { class: "page-header" }, h("h1", null, title)),
    ];
  }

  function root() {
    el.append(...[
      h("header", { class: "page-header" }, h("h1", null, "Ajustes")),
      store.corrupt && h("div", { class: "warning" }, "Los datos guardados no se pudieron leer y se ha empezado de cero. El contenido original se conserva en el navegador; importa una copia de seguridad si tienes una."),
      h("div", { class: "card list" },
        navRow("Cuentas", `${state.accounts.length} cuentas`, () => goto("accounts")),
        navRow("Categorías", `${state.categories.length} categorías`, () => goto("categories")),
        navRow("Movimientos recurrentes", `${state.recurring.length} configurados`, () => goto("recurring"))),
      h("div", { class: "section-title" }, "Copia de seguridad"),
      h("div", { class: "card list" },
        navRow("Exportar datos", "Guarda un archivo JSON con todo", exportBackup),
        navRow("Importar datos", "Reemplaza los datos con un archivo JSON", importBackup)),
      h("div", { class: "section-title" }, "Información"),
      h("div", { class: "card list" },
        h("div", { class: "row" }, h("div", { class: "row-main" }, h("div", { class: "row-title" }, "Versión")), h("div", { class: "muted" }, APP_VERSION))),
    ].filter(Boolean));
  }

  function accounts() {
    el.append(...subHeader("Cuentas"),
      h("div", { class: "card list" }, [...state.accounts].sort((a, b) => a.order - b.order).map(acc => {
        const content = h("div", { class: "row tappable", onClick: () => openAccountSheet({ store, account: acc }) },
          iconBubble(acc.icon, acc.color, 40),
          h("div", { class: "row-main" },
            h("div", { class: "row-title" }, acc.name),
            h("div", { class: "row-sub" }, acc.valuation === "manual" ? "Valor manual" : `Saldo inicial ${formatMoney(acc.initialBalance)}${acc.annualRate > 0 ? ` · ${String(acc.annualRate).replace(".", ",")} % anual` : ""}`)),
          h("span", { class: "chevron" }, "›"));
        return swipeRow(content, () => {
          if (accountInUse(state, acc.id)) { toast("No se puede borrar: la cuenta tiene movimientos"); return; }
          if (confirm(`¿Borrar la cuenta "${acc.name}"?`)) deleteAccount(store, acc.id);
        });
      })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openAccountSheet({ store }) }, "+ Añadir cuenta"));
  }

  function categories() {
    el.append(...subHeader("Categorías"),
      h("div", { class: "card list" }, [...state.categories].sort((a, b) => a.order - b.order).map(cat => {
        const uses = categoryUsageCount(state, cat.id);
        const content = h("div", { class: "row tappable", onClick: () => openCategorySheet({ store, category: cat }) },
          iconBubble(cat.icon, cat.color, 40),
          h("div", { class: "row-main" },
            h("div", { class: "row-title" }, cat.name, cat.system && h("span", { class: "badge" }, "Sistema")),
            h("div", { class: "row-sub" }, uses === 1 ? "1 movimiento" : `${uses} movimientos`)),
          h("span", { class: "chevron" }, "›"));
        return swipeRow(content, () => {
          if (cat.system) { toast("Las categorías de sistema no se pueden borrar"); return; }
          const msg = uses > 0 ? `"${cat.name}" tiene ${uses} movimientos. Se moverán a "Otros". ¿Borrar?` : `¿Borrar la categoría "${cat.name}"?`;
          if (confirm(msg)) deleteCategory(store, cat.id);
        });
      })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openCategorySheet({ store }) }, "+ Añadir categoría"));
  }

  function recurring() {
    const accName = id => state.accounts.find(a => a.id === id)?.name || "¿?";
    const cat = id => state.categories.find(c => c.id === id);
    el.append(...subHeader("Recurrentes"),
      state.recurring.length === 0
        ? emptyState("Sin movimientos recurrentes. Añade la nómina, el alquiler o cualquier gasto fijo.")
        : h("div", { class: "card list" }, state.recurring.map(r => {
            const c = cat(r.categoryId);
            const content = h("div", { class: "row tappable", onClick: () => openRecurringSheet({ store, recurring: r }) },
              iconBubble(c?.icon ?? "•", c?.color ?? "#999", 40),
              h("div", { class: "row-main" },
                h("div", { class: "row-title" }, r.note || c?.name || "Recurrente", !r.active && h("span", { class: "badge" }, "Pausado")),
                h("div", { class: "row-sub" }, `Día ${r.dayOfMonth} · ${accName(r.accountId)}`)),
              h("div", { class: "row-amount " + (r.type === "expense" ? "neg" : "pos") }, formatMoney(r.type === "expense" ? -r.amount : r.amount, { sign: r.type === "income" })));
            return swipeRow(content, () => { if (confirm("¿Borrar este recurrente? Los movimientos ya registrados se conservan.")) deleteRecurring(store, r.id); });
          })),
      h("button", { type: "button", class: "btn-secondary", onClick: () => openRecurringSheet({ store }) }, "+ Añadir recurrente"));
  }

  async function exportBackup() {
    const name = `finanzas-${todayStr()}.json`;
    const blob = new Blob([exportJSON(store.getState())], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Copia de seguridad Finanzas" });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Archivo descargado");
  }

  function importBackup() {
    if (importInput) { importInput.remove(); importInput = null; }
    const input = h("input", {
      type: "file", accept: "application/json,.json",
      style: { position: "fixed", left: "-9999px", width: "1px", height: "1px", opacity: "0" },
    });
    importInput = input;
    const cleanup = () => {
      if (importInput === input) importInput = null;
      input.remove();
    };
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      cleanup();
      if (!f) return;
      try {
        const data = parseImport(await f.text());
        if (!confirm(`Se reemplazarán todos los datos actuales por ${data.transactions.length} movimientos y ${data.accounts.length} cuentas. ¿Continuar?`)) return;
        store.replace(data);
        toast("Datos importados");
      } catch (err) {
        toast(`No se pudo importar: ${err.message}`);
      }
    });
    input.addEventListener("cancel", cleanup);
    document.body.append(input);
    input.click();
  }
}
