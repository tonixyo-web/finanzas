import { h } from "../ui.js";

export function renderTransactions(el) {
  el.append(h("header", { class: "page-header" }, h("h1", null, "Movimientos")));
}
