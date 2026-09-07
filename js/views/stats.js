import { h, monthPicker, iconBubble, emptyState } from "../ui.js";
import { donutChart, barChart, lineChart } from "../charts.js";
import { formatMoney, shortMonthLabel, monthLabel, capitalize } from "../format.js";
import { expensesByCategory, monthSeries, netWorthSeries, categorySeries } from "../model.js";

export function renderStats(el, ctx) {
  const { store, ui } = ctx;
  const state = store.getState();
  const ym = ui.statsMonth;
  const catById = id => state.categories.find(c => c.id === id);
  const rerender = () => { el.innerHTML = ""; renderStats(el, ctx); };

  el.append(
    h("header", { class: "page-header" }, h("h1", null, "Estadísticas")),
    monthPicker(ym, m => { ui.statsMonth = m; ui.statsCategory = null; ui.statsBar = 11; rerender(); }));

  el.append(ui.statsCategory ? categoryCard() : donutCard());
  el.append(barsCard(), netWorthCard());

  function donutCard() {
    const rows = expensesByCategory(state, ym);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const slices = rows.map(r => { const c = catById(r.categoryId); return { id: r.categoryId, label: c?.name ?? "Otros", value: r.amount, color: c?.color ?? "#999" }; });
    const select = id => { ui.statsCategory = id; rerender(); };
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Gastos por categoría"),
      h("div", { class: "chart-wrap" }, donutChart({ slices, centerTop: formatMoney(total), centerBottom: capitalize(monthLabel(ym)), onSelect: select })),
      rows.length === 0 ? emptyState("Sin gastos este mes") : h("div", { class: "legend" }, slices.map(s =>
        h("div", { class: "legend-row", onClick: () => select(s.id) },
          h("span", { class: "legend-dot", style: { background: s.color } }),
          h("span", { class: "legend-name" }, s.label),
          h("span", { class: "num" }, formatMoney(s.value)),
          h("span", { class: "legend-pct" }, `${Math.round(100 * s.value / total)} %`)))));
  }

  function categoryCard() {
    const cat = catById(ui.statsCategory);
    const series = categorySeries(state, ui.statsCategory, ym, 12);
    const total = series.reduce((s, x) => s + x.amount, 0);
    const average = Math.round(total / 12);
    return h("section", { class: "card" },
      h("button", { type: "button", class: "settings-back", onClick: () => { ui.statsCategory = null; rerender(); } }, "‹ Categorías"),
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px", margin: "8px 0 12px" } },
        iconBubble(cat?.icon ?? "•", cat?.color ?? "#999", 36),
        h("div", null, h("div", { class: "bold" }, cat?.name ?? "Categoría"), h("div", { class: "small muted" }, "Últimos 12 meses"))),
      h("div", { class: "chart-wrap" }, barChart({
        groups: series.map(s => ({ label: shortMonthLabel(s.ym), values: [s.amount] })),
        series: [{ name: cat?.name ?? "", color: cat?.color ?? "#999" }],
        average,
      })),
      h("div", { class: "stat-grid" },
        h("div", null, h("div", { class: "v" }, formatMoney(total)), h("div", { class: "l" }, "Total 12 meses")),
        h("div", null, h("div", { class: "v" }, formatMoney(average)), h("div", { class: "l" }, "Media mensual")),
        h("div", null, h("div", { class: "v" }, formatMoney(series[11].amount)), h("div", { class: "l" }, capitalize(shortMonthLabel(ym))))));
  }

  function barsCard() {
    const series = monthSeries(state, ym, 12);
    const idx = Math.min(11, Math.max(0, ui.statsBar ?? 11));
    const sel = series[idx];
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Ingresos, gastos y ahorro"),
      h("div", { class: "chart-wrap" }, barChart({
        groups: series.map(s => ({ label: shortMonthLabel(s.ym), values: [s.income, s.expense, Math.max(0, s.savings)] })),
        series: [{ name: "Ingresos", color: "var(--green)" }, { name: "Gastos", color: "var(--red)" }, { name: "Ahorro", color: "var(--accent)" }],
        selectedIndex: idx,
        onSelect: i => { ui.statsBar = i; rerender(); },
      })),
      h("div", { class: "legend-inline" },
        h("span", { style: { "--dot": "var(--green)" } }, "Ingresos"),
        h("span", { style: { "--dot": "var(--red)" } }, "Gastos"),
        h("span", { style: { "--dot": "var(--accent)" } }, "Ahorro")),
      h("div", { class: "small muted", style: { marginTop: "10px" } }, capitalize(monthLabel(sel.ym))),
      h("div", { class: "stat-grid" },
        h("div", null, h("div", { class: "v pos" }, formatMoney(sel.income)), h("div", { class: "l" }, "Ingresos")),
        h("div", null, h("div", { class: "v neg" }, formatMoney(sel.expense)), h("div", { class: "l" }, "Gastos")),
        h("div", null, h("div", { class: "v" }, formatMoney(sel.savings)), h("div", { class: "l" }, "Ahorro"))));
  }

  function netWorthCard() {
    const series = netWorthSeries(state, ym);
    return h("section", { class: "card" },
      h("div", { class: "card-title" }, "Evolución del patrimonio"),
      h("div", { class: "chart-wrap" }, lineChart({
        points: series.map(p => ({ label: `${shortMonthLabel(p.ym)} ${p.ym.slice(2, 4)}`, value: p.value })),
        format: formatMoney,
      })));
  }
}
