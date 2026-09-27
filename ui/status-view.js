// Status screen: data sync state, the iPhone -> Mac bridge test, backup, environment.

import { esc, longDate, timeAgo, localToday } from "./format.js";
import * as bridge from "../lib/bridge.js";
import { toMarkdown, buildEvent } from "../lib/events.js";

export async function renderStatus(root, { appData, importedAt, queue, onSync, version }) {
  const shortcutName = await bridge.shortcutName();
  const d = appData?.data;
  const open = queue.filter((e) => e.status !== "processed").length;

  root.innerHTML = `
    <header class="screen-head"><h1>Status</h1></header>
    <section>
      <h2>Data</h2>
      <article class="card list">
        ${row("Data from", appData ? longDate(appData.updated) : "not imported")}
        ${row("Synced", timeAgo(importedAt))}
        ${d ? row("Sessions / daily notes", `${d.sessions.length} / ${d.dailies.length}`) : ""}
        ${d ? row("Kilter sends", String(d.kilter?.sends?.length ?? 0)) : ""}
        ${row("Logs not on the Mac yet", String(open))}
      </article>
      <button class="btn" data-action="sync">Sync from iCloud</button>
      <p class="muted small">Pick <strong>Bouldering &rsaquo; 00_Inbox &rsaquo; App &rsaquo; app-data.json</strong> in iCloud Drive.</p>
    </section>
    <section>
      <h2>Shortcut</h2>
      <article class="card">
        <p class="muted small">Every log is handed to this Shortcut, which saves it to <strong>00_Inbox/App/</strong> in iCloud.</p>
        <label class="field-label" for="shortcut">Shortcut name</label>
        <input id="shortcut" class="field-input" value="${esc(shortcutName)}" autocapitalize="off" autocorrect="off">
        <button class="btn-secondary" data-action="test">Send a test file</button>
      </article>
    </section>
    <section>
      <h2>Backup</h2>
      <article class="card">
        <p class="muted small">All logs on this phone plus the last synced data, as one JSON file.</p>
        <button class="btn-secondary" data-action="backup">Export backup</button>
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
  root.querySelector("#shortcut").addEventListener("change", (ev) => bridge.setShortcutName(ev.target.value));
  root.querySelector("[data-action=test]").addEventListener("click", async () => {
    await bridge.setShortcutName(root.querySelector("#shortcut").value);
    const ev = buildEvent("test", localToday(), { method: "shortcut", standalone: isStandalone(), online: navigator.onLine });
    await bridge.sendViaShortcut(toMarkdown(ev, "Test file from the Boulder app. Can be deleted."));
  });
  root.querySelector("[data-action=backup]").addEventListener("click", async () => {
    const backup = { exportedAt: new Date().toISOString(), version, queue, appData, importedAt, shortcut: await bridge.shortcutName() };
    const file = new File([JSON.stringify(backup, null, 2)], `boulder-backup-${localToday()}.json`, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch (err) {
      if (err.name !== "AbortError") alert(err.message);
    }
  });
}

const row = (label, value) =>
  `<div class="list-row"><div class="list-name">${esc(label)}</div><div class="list-value">${esc(value)}</div></div>`;
const flag = (label, on) =>
  `<div class="list-row"><div class="list-name">${esc(label)}</div><div class="list-value ${on ? "yes" : "no"}">${on ? "yes" : "no"}</div></div>`;

export const isStandalone = () => window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
