import { h } from "../ui.js";

export function renderStats(el) {
  el.append(h("header", { class: "page-header" }, h("h1", null, "Estadísticas")));
}
