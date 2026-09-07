const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function splitYm(ym) {
  const [y, m] = ym.split("-").map(Number);
  return { y, m };
}

export function addMonths(ym, n) {
  const { y, m } = splitYm(ym);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

export function lastDayOfMonth(ym) {
  const { y, m } = splitYm(ym);
  return `${ym}-${pad2(new Date(y, m, 0).getDate())}`;
}

export function monthRange(endYm, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(endYm, -i));
  return out;
}

export function monthLabel(ym) {
  const { y, m } = splitYm(ym);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shortMonthLabel(ym) {
  return MONTHS_SHORT[splitYm(ym).m - 1];
}

export function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function dayLabel(dateStr, today = todayStr()) {
  if (dateStr === today) return "Hoy";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const yesterday = new Date(dt); yesterday.setDate(d + 1);
  if (todayStr(yesterday) === today) return "Ayer";
  return `${capitalize(DAYS[dt.getDay()])} ${d} de ${MONTHS[m - 1]}`;
}

export function formatMoney(cents, { sign = false } = {}) {
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  const int = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = pad2(abs % 100);
  const prefix = rounded < 0 ? "-" : (sign && rounded > 0 ? "+" : "");
  return `${prefix}${int},${dec}\u00a0€`;
}

export function parseAmount(str) {
  if (typeof str !== "string") return null;
  let clean = str.trim();
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}
