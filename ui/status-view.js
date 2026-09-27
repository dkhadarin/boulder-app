// Status screen: data sync state, the iPhone -> Mac bridge test (phase 0), environment.

import { esc, longDate, timeAgo } from "./format.js";
import * as store from "../lib/store.js";

const LOG_KEY = "bridgeLog";
const NAME_KEY = "shortcutName";

export async function renderStatus(root, { appData, importedAt, onSync, version }) {
  const shortcutName = (await store.get(NAME_KEY)) || "Boulder Save";
  const log = (await store.get(LOG_KEY)) || [];
  const d = appData?.data;

  root.innerHTML = `
    <header class="screen-head"><h1>Status</h1></header>
    <section>
      <h2>Data</h2>
      <article class="card list">
        ${row("Data from", appData ? longDate(appData.updated) : "not imported")}
        ${row("Synced", timeAgo(importedAt))}
        ${d ? row("Sessions / daily notes", `${d.sessions.length} / ${d.dailies.length}`) : ""}
        ${d ? row("Kilter sends", String(d.kilter?.sends?.length ?? 0)) : ""}
      </article>
      <button class="btn" data-action="sync">Sync from iCloud</button>
      <p class="muted small">Pick <strong>Bouldering &rsaquo; 00_Inbox &rsaquo; App &rsaquo; app-data.json</strong> in iCloud Drive.</p>
    </section>
    <section>
      <h2>Bridge test</h2>
      <article class="card">
        <p class="muted small">Sends a test file through the Shortcut into <strong>00_Inbox/App/</strong> on the Mac.</p>
        <label class="field-label" for="shortcut">Shortcut name</label>
        <input id="shortcut" class="field" value="${esc(shortcutName)}" autocapitalize="off" autocorrect="off">
        <button class="btn" data-action="shortcut">Save test file via Shortcut</button>
        <button class="btn-secondary" data-action="share">Fallback: share test file</button>
        <h3 class="small-head">Attempts on this phone</h3>
        <div class="bridge-log">${log.length ? log.map((e) => `<div>${esc(e.time)} · ${esc(e.method)} · ${esc(e.file)}</div>`).join("") : "<div>No attempts yet</div>"}</div>
      </article>
    </section>
    <section>
      <h2>Environment</h2>
      <article class="card list">
        ${flag("Home-screen app", isStandalone())}
        ${flag("Online", navigator.onLine)}
        ${flag("Offline cache", !!navigator.serviceWorker?.controller)}
        ${row("App version", version)}
      </article>
    </section>`;

  root.querySelector("[data-action=sync]").addEventListener("click", onSync);
  root.querySelector("#shortcut").addEventListener("change", (ev) => store.set(NAME_KEY, ev.target.value.trim()));
  root.querySelector("[data-action=shortcut]").addEventListener("click", async () => {
    const name = root.querySelector("#shortcut").value.trim();
    await store.set(NAME_KEY, name);
    const event = testEvent("shortcut");
    await addLog(event, "shortcut");
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(JSON.stringify(event))}`;
  });
  root.querySelector("[data-action=share]").addEventListener("click", async () => {
    const event = testEvent("share");
    const file = new File([event.content], event.file, { type: "text/markdown" });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      alert("Sharing files is not supported here.");
      return;
    }
    try {
      await navigator.share({ files: [file] });
      await addLog(event, "share");
    } catch (err) {
      if (err.name !== "AbortError") alert(`Share failed: ${err.message}`);
    }
  });
}

const row = (label, value) =>
  `<div class="list-row"><div class="list-name">${esc(label)}</div><div class="list-value">${esc(value)}</div></div>`;
const flag = (label, on) =>
  `<div class="list-row"><div class="list-name">${esc(label)}</div><div class="list-value ${on ? "yes" : "no"}">${on ? "yes" : "no"}</div></div>`;

export const isStandalone = () => window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

async function addLog(event, method) {
  const log = (await store.get(LOG_KEY)) || [];
  await store.set(LOG_KEY, [{ time: new Date().toLocaleTimeString(), method, file: event.file }, ...log].slice(0, 20));
}

// One test event in the same shape the real events will have.
function testEvent(method) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const id = crypto.randomUUID ? crypto.randomUUID() : String(now.getTime());
  const content = [
    "---",
    "event: test",
    `id: ${id}`,
    `created: ${now.toISOString()}`,
    `method: ${method}`,
    `standalone: ${isStandalone()}`,
    `online: ${navigator.onLine}`,
    "---",
    "Test file from the Boulder app (spike). Can be deleted.",
    "",
  ].join("\n");
  return { file: `${stamp} test.md`, content };
}
