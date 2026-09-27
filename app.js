// Boulder app shell: tabs, data import, local logs, rendering.

import { computeProgress } from "./lib/progress.js";
import { withPending, pendingEvents } from "./lib/pending.js";
import * as store from "./lib/store.js";
import * as queue from "./lib/queue.js";
import { localToday, longDate } from "./ui/format.js";
import { renderProgress, renderEmpty } from "./ui/progress-view.js";
import { renderLog } from "./ui/log-view.js";
import { renderStatus } from "./ui/status-view.js";

const VERSION = "0.4 (phase 4)";
const TABS = ["progress", "log", "status"];
const view = document.getElementById("view");
const fileInput = document.getElementById("file-input");
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
const params = new URLSearchParams(location.search);

const state = { appData: null, importedAt: null, queue: [] };

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
  state.queue = await queue.reconcile(json.data.events);
}

// Logs saved on the phone that the Mac has not turned into notes yet.
const localEvents = () => state.queue.filter((e) => e.status !== "processed").map((e) => e.event);

function currentData(extra = []) {
  if (!state.appData) return null;
  return withPending(state.appData.data, [...localEvents(), ...extra]);
}

function modelWith(extra = []) {
  const data = currentData(extra);
  return data ? computeProgress(data, state.appData.manual, today()) : null;
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
function route() {
  const parts = location.hash.slice(1).split("/").map(decodeURIComponent);
  const tab = TABS.includes(parts[0]) ? parts[0] : "progress";
  return { tab, rest: parts.slice(1) };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const { tab, rest } = route();
  for (const button of document.querySelectorAll(".tab")) {
    button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false");
  }
  window.scrollTo(0, 0);
  state.queue = await queue.all();
  if (tab === "progress") {
    if (!state.appData) renderEmpty(view, sync);
    else {
      const pending = state.appData ? pendingEvents(state.appData.data, localEvents()).length : 0;
      renderProgress(view, modelWith(), { importedAt: state.importedAt, pending }, sync);
    }
  } else if (tab === "log") {
    await renderLog(view, { data: currentData(), today: today(), route: rest, go, modelWith, refresh: render });
  } else {
    renderStatus(view, { ...state, onSync: sync, version: VERSION });
  }
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
window.addEventListener("online", () => route().tab === "status" && render());
window.addEventListener("offline", () => route().tab === "status" && render());
// Coming back from the Shortcuts app: refresh the statuses.
// Not while a form is open - that would reset the scroll position mid-typing.
document.addEventListener("visibilitychange", () => {
  const { tab, rest } = route();
  if (document.visibilityState === "visible" && tab === "log" && (!rest.length || rest[0] === "saved")) render();
});

async function start() {
  state.appData = (await store.get("appData")) || null;
  state.importedAt = (await store.get("importedAt")) || null;
  state.queue = await queue.all();

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
