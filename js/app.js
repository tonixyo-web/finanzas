import { createStore, postAutomatic } from "./store.js";
import { todayStr, monthKey } from "./format.js";
import { renderHome } from "./views/home.js";
import { renderTransactions } from "./views/transactions.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";

const store = createStore();
postAutomatic(store);

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
  views[current](main, { store, ui, navigate });
  document.querySelectorAll(".tabbar a").forEach(a => a.classList.toggle("active", a.dataset.tab === current));
  window.scrollTo(0, scrollY);
}

window.addEventListener("hashchange", () => {
  const t = tabFromHash();
  if (t !== current) { current = t; window.scrollTo(0, 0); render(); }
});
store.subscribe(render);
render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
