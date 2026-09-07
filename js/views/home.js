import { h } from "../ui.js";

export function renderHome(el) {
  el.append(h("header", { class: "page-header" }, h("h1", null, "Inicio")));
}
