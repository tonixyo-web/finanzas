import { addMonths, monthLabel, capitalize } from "./format.js";

const PROPS = new Set(["value", "checked", "selected", "disabled", "textContent"]);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith("--")) el.style.setProperty(prop, val); else el.style[prop] = val;
      }
    }
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function openSheet({ title, content, saveLabel = "Guardar", onSave }) {
  const overlay = h("div", { class: "sheet-overlay" });
  const close = () => {
    overlay.classList.remove("open");
    document.body.classList.remove("no-scroll");
    setTimeout(() => overlay.remove(), 300);
  };
  const saveBtn = onSave
    ? h("button", { class: "btn-text bold", type: "button", onClick: async () => { if ((await onSave()) !== false) close(); } }, saveLabel)
    : h("span");
  const sheet = h("div", { class: "sheet" },
    h("div", { class: "sheet-handle" }),
    h("div", { class: "sheet-header" },
      h("button", { class: "btn-text", type: "button", onClick: close }, "Cancelar"),
      h("div", { class: "sheet-title" }, title),
      saveBtn),
    h("div", { class: "sheet-body" }, content));
  overlay.append(sheet);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => overlay.classList.add("open"));
  return { close };
}

export function toast(msg) {
  const t = h("div", { class: "toast" }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

export function monthPicker(ym, onChange) {
  return h("div", { class: "month-picker" },
    h("button", { class: "btn-icon", type: "button", "aria-label": "Mes anterior", onClick: () => onChange(addMonths(ym, -1)) }, "‹"),
    h("span", { class: "month-label" }, capitalize(monthLabel(ym))),
    h("button", { class: "btn-icon", type: "button", "aria-label": "Mes siguiente", onClick: () => onChange(addMonths(ym, 1)) }, "›"));
}

export function iconBubble(icon, color, size = 36) {
  return h("span", { class: "bubble", style: { background: color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` } }, icon);
}

export function field(label, control) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control);
}

export function select(options, value, onChange) {
  const s = h("select", { class: "input", onChange: e => onChange(e.target.value) });
  for (const o of options) s.append(h("option", { value: o.value }, o.label));
  s.value = value ?? "";
  return s;
}

export function emptyState(text) {
  return h("div", { class: "empty" }, text);
}

export function swipeRow(content, onDelete) {
  content.classList.add("swipe-content");
  const wrap = h("div", { class: "swipe" },
    h("button", { class: "swipe-delete", type: "button", onClick: onDelete }, "Borrar"),
    content);
  let startX = 0, startY = 0, dx = 0, open = false, dragging = false;
  content.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dragging = false; content.style.transition = "none";
  }, { passive: true });
  content.addEventListener("touchmove", e => {
    const mx = e.touches[0].clientX - startX, my = e.touches[0].clientY - startY;
    if (!dragging && Math.abs(mx) < Math.abs(my)) return;
    dragging = true;
    dx = Math.max(-88, Math.min(0, mx + (open ? -88 : 0)));
    content.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  content.addEventListener("touchend", () => {
    content.style.transition = "";
    open = dragging ? dx < -44 : false;
    content.style.transform = open ? "translateX(-88px)" : "";
  });
  content.addEventListener("click", e => {
    if (dragging) { e.stopPropagation(); e.preventDefault(); dragging = false; }
  }, true);
  return wrap;
}
