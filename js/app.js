import { createStore, postAutomatic } from "./store.js";
import { todayStr, monthKey } from "./format.js";
import { h, toast } from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderTransactions } from "./views/transactions.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";

const store = createStore();

function safePostAutomatic() {
  try {
    postAutomatic(store);
  } catch (err) {
    console.error(err);
    toast("No se pudieron registrar los movimientos automáticos");
  }
}
safePostAutomatic();

const views = { home: renderHome, transactions: renderTransactions, stats: renderStats, settings: renderSettings };
const main = document.getElementById("view");
const currentYm = monthKey(todayStr());
const ui = { month: currentYm, statsMonth: currentYm, statsCategory: null, statsBar: 11, settingsPage: "root" };

let current = tabFromHash();

function tabFromHash() {
  const t = location.hash.slice(1);
  return views[t] ? t : "home";
}

function navigate(tab) {
  if (!views[tab]) return;
  current = tab;
  if (location.hash !== `#${tab}`) location.hash = tab;
  render();
}

function render() {
  const scrollY = window.scrollY;
  main.innerHTML = "";
  try {
    views[current](main, { store, ui, navigate });
  } catch (err) {
    console.error(err);
    main.innerHTML = "";
    main.append(h("div", { class: "warning" }, "Error al mostrar esta pantalla. Ve a Ajustes → Importar datos para restaurar una copia."));
  }
  document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === current));
  window.scrollTo(0, scrollY);
}

if (store.corrupt) {
  main.before(h("div", { class: "warning" },
    "Los datos guardados no se pudieron leer y se ha empezado de cero. El contenido original se conserva en el navegador; importa una copia de seguridad si tienes una. Ajustes → Importar datos."));
}

window.addEventListener("hashchange", () => {
  const t = tabFromHash();
  if (t !== current) { current = t; window.scrollTo(0, 0); render(); }
});
store.subscribe(render);
window.addEventListener("store-error", () => toast("No se pudo guardar en el dispositivo"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") safePostAutomatic();
});
render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
