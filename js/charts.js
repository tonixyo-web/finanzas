const NS = "http://www.w3.org/2000/svg";

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function ringChart({ fraction, color, size = 84, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction || 0));
  const common = { cx: size / 2, cy: size / 2, r, fill: "none", "stroke-width": stroke };
  return svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "ring" },
    svg("circle", { ...common, stroke: color, "stroke-opacity": 0.2 }),
    svg("circle", { ...common, stroke: color, "stroke-linecap": "round", "stroke-dasharray": `${c * f} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})` }));
}

export function donutChart({ slices, centerTop, centerBottom, selectedId = null, onSelect }) {
  const size = 220, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const el = svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "donut" });
  if (total === 0) {
    el.append(svg("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "var(--sep)", "stroke-width": stroke }));
  }
  let offset = 0;
  for (const s of slices) {
    if (s.value <= 0) continue;
    const len = c * s.value / total;
    const gap = slices.length > 1 ? 2 : 0;
    const circle = svg("circle", {
      cx: size / 2, cy: size / 2, r, fill: "none", stroke: s.color, class: "donut-slice",
      "stroke-width": selectedId === s.id ? stroke + 6 : stroke,
      "stroke-dasharray": `${Math.max(0, len - gap)} ${c - len + gap}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      opacity: selectedId && selectedId !== s.id ? 0.35 : 1,
    });
    circle.addEventListener("click", () => onSelect?.(s.id));
    el.append(circle);
    offset += len;
  }
  el.append(
    svg("text", { x: size / 2, y: size / 2 - 2, "text-anchor": "middle", class: "donut-center" }, centerTop),
    svg("text", { x: size / 2, y: size / 2 + 18, "text-anchor": "middle", class: "donut-sub" }, centerBottom));
  return el;
}

export function barChart({ groups, series, selectedIndex = null, onSelect, average = null }) {
  const W = 340, H = 180, padX = 6, padT = 12, padB = 22;
  const max = Math.max(1, ...groups.flatMap(g => g.values), average ?? 0);
  const gw = (W - padX * 2) / Math.max(1, groups.length);
  const n = Math.max(1, series.length);
  const bw = Math.max(2, (gw - 6) / n);
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "bars" });
  groups.forEach((g, i) => {
    const gx = padX + i * gw;
    const grp = svg("g", { class: "bar-group", opacity: selectedIndex != null && selectedIndex !== i ? 0.4 : 1, style: "cursor:pointer" });
    grp.append(svg("rect", { x: gx, y: 0, width: gw, height: H, fill: "transparent" }));
    g.values.forEach((v, j) => {
      const top = y(v);
      grp.append(svg("rect", { x: gx + 3 + j * bw, y: top, width: Math.max(1, bw - 1.5), height: Math.max(0, H - padB - top), rx: 2, fill: series[j].color }));
    });
    grp.append(svg("text", { x: gx + gw / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }, g.label));
    grp.addEventListener("click", () => onSelect?.(i));
    el.append(grp);
  });
  if (average != null) {
    el.append(svg("line", { x1: padX, x2: W - padX, y1: y(average), y2: y(average), stroke: "var(--text-2)", "stroke-dasharray": "4 3", "stroke-width": 1 }));
  }
  return el;
}

export function lineChart({ points, format }) {
  const W = 340, H = 160, pad = 14, padB = 20;
  const vals = points.map(p => p.value);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const x = i => (points.length === 1 ? W / 2 : pad + (W - pad * 2) * i / (points.length - 1));
  const y = v => pad + (H - pad - padB) * (1 - (v - min) / (max - min || 1));
  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`);
  const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "line" });
  const first = points[0], last = points[points.length - 1];
  el.append(
    svg("polygon", { points: [`${x(0)},${H - padB}`, ...coords, `${x(points.length - 1)},${H - padB}`].join(" "), fill: "var(--accent)", opacity: 0.12 }),
    svg("polyline", { points: coords.join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    svg("circle", { cx: x(points.length - 1), cy: y(last.value), r: 4, fill: "var(--accent)" }),
    svg("text", { x: x(0), y: H - 4, class: "axis-label" }, first.label),
    svg("text", { x: x(points.length - 1), y: H - 4, "text-anchor": "end", class: "axis-label" }, last.label),
    svg("text", { x: x(points.length - 1), y: y(last.value) - 10, "text-anchor": "end", class: "point-label" }, format(last.value)));
  if (points.length > 1) {
    el.append(svg("text", { x: x(0), y: y(first.value) - 10, class: "point-label" }, format(first.value)));
  }
  return el;
}
