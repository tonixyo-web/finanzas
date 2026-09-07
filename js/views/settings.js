import { h } from "../ui.js";

export function renderSettings(el) {
  el.append(h("header", { class: "page-header" }, h("h1", null, "Ajustes")));
}
