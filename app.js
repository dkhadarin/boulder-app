// Boulder app shell: tabs, data import, rendering.

import { computeProgress } from "./lib/progress.js";
import * as store from "./lib/store.js";
import { localToday, longDate } from "./ui/format.js";
import { renderProgress, renderEmpty } from "./ui/progress-view.js";
import { renderStatus } from "./ui/status-view.js";

const VERSION = "0.2 (phase 2)";
const TABS = ["progress", "log", "status"];
const view = document.getElementById("view");
const fileInput = document.getElementById("file-input");
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const params = new URLSearchParams(location.search);

const state = { appData: null, importedAt: null };

// On localhost only: ?today=YYYY-MM-DD to preview another day.
const today = () => (isLocal && params.get("today")) || localToday();

// ---------- data ----------
function isAppData(json) {
  return json && json.version === 1 && json.data && json.manual && Array.isArray(json.data.sessions);
}

async function saveAppData(json) {
  if (!isAppData(json)) throw new Error("This is not an app-data.json from the Boulder vault.");
  state.appData = json;
  state.importedAt = new Date().toISOString();
  await store.set("appData", json);
  await store.set("importedAt", state.importedAt);
}

function sync() {
  fileInput.value = "";
  fileInput.click();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    await saveAppData(JSON.parse(await file.text()));
    toast(`Synced - data from ${longDate(state.appData.updated)}`);
    render();
  } catch (err) {
    toast(err instanceof SyntaxError ? "Could not read the file." : err.message);
  }
});

// ---------- views ----------
function renderLog(root) {
  root.innerHTML = `
    <header class="screen-head"><h1>Log</h1></header>
    <article class="card empty-card">
      <h2>Coming in phase 4</h2>
      <p>Forms for Monday, Thursday, Saturday, home days and the morning check.</p>
      <p class="muted">Until then: tell Claude after the session, as before.</p>
    </article>`;
}

function currentTab() {
  const tab = location.hash.slice(1);
  return TABS.includes(tab) ? tab : "progress";
}

function render() {
  const tab = currentTab();
  for (const button of document.querySelectorAll(".tab")) {
    button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false");
  }
  window.scrollTo(0, 0);
  if (tab === "progress") {
    if (!state.appData) renderEmpty(view, sync);
    else {
      const model = computeProgress(state.appData.data, state.appData.manual, today());
      renderProgress(view, model, { importedAt: state.importedAt }, sync);
    }
  } else if (tab === "log") renderLog(view);
  else renderStatus(view, { ...state, onSync: sync, version: VERSION });
}

let toastTimer = null;
function toast(text) {
  const box = document.getElementById("toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 3500);
}

// ---------- start ----------
window.addEventListener("hashchange", render);
window.addEventListener("online", () => currentTab() === "status" && render());
window.addEventListener("offline", () => currentTab() === "status" && render());

async function start() {
  state.appData = (await store.get("appData")) || null;
  state.importedAt = (await store.get("importedAt")) || null;

  // On localhost only: ?import=<url> loads a data file without the picker (for testing).
  if (isLocal && params.get("import")) {
    try {
      await saveAppData(await (await fetch(params.get("import"))).json());
    } catch (err) {
      toast(err.message);
    }
  }
  render();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
start();
