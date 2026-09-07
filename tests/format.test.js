import { test, assertEqual } from "./runner.js";
import {
  pad2, todayStr, monthKey, addMonths, lastDayOfMonth, monthRange,
  monthLabel, shortMonthLabel, dayLabel, capitalize, formatMoney, parseAmount
} from "../js/format.js";

test("pad2 rellena con cero", () => {
  assertEqual(pad2(3), "03");
  assertEqual(pad2(12), "12");
});

test("todayStr usa la fecha local", () => {
  assertEqual(todayStr(new Date(2026, 8, 7)), "2026-09-07");
});

test("monthKey recorta a YYYY-MM", () => {
  assertEqual(monthKey("2026-09-07"), "2026-09");
});

test("addMonths cruza años en ambos sentidos", () => {
  assertEqual(addMonths("2026-12", 1), "2027-01");
  assertEqual(addMonths("2026-01", -1), "2025-12");
  assertEqual(addMonths("2026-03", 0), "2026-03");
});

test("lastDayOfMonth respeta bisiestos", () => {
  assertEqual(lastDayOfMonth("2024-02"), "2024-02-29");
  assertEqual(lastDayOfMonth("2026-09"), "2026-09-30");
});

test("monthRange devuelve n meses terminando en endYm", () => {
  assertEqual(monthRange("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
});

test("monthLabel y shortMonthLabel en castellano", () => {
  assertEqual(monthLabel("2026-09"), "septiembre 2026");
  assertEqual(shortMonthLabel("2026-01"), "ene");
  assertEqual(capitalize("septiembre 2026"), "Septiembre 2026");
});

test("dayLabel devuelve Hoy, Ayer o día con nombre", () => {
  assertEqual(dayLabel("2026-09-07", "2026-09-07"), "Hoy");
  assertEqual(dayLabel("2026-09-06", "2026-09-07"), "Ayer");
  assertEqual(dayLabel("2026-09-01", "2026-09-07"), "Martes 1 de septiembre");
});

test("formatMoney con miles, decimales y signo", () => {
  assertEqual(formatMoney(123456), "1.234,56\u00a0€");
  assertEqual(formatMoney(5), "0,05\u00a0€");
  assertEqual(formatMoney(-250000), "-2.500,00\u00a0€");
  assertEqual(formatMoney(1000, { sign: true }), "+10,00\u00a0€");
  assertEqual(formatMoney(0, { sign: true }), "0,00\u00a0€");
  assertEqual(formatMoney(123456789), "1.234.567,89\u00a0€");
});

test("parseAmount acepta coma, punto y miles", () => {
  assertEqual(parseAmount("12,5"), 1250);
  assertEqual(parseAmount("12.5"), 1250);
  assertEqual(parseAmount("1.234,56"), 123456);
  assertEqual(parseAmount("1234"), 123400);
  assertEqual(parseAmount(" 7 "), 700);
  assertEqual(parseAmount(""), null);
  assertEqual(parseAmount("abc"), null);
  assertEqual(parseAmount("1,234"), null);
  assertEqual(parseAmount(null), null);
});
