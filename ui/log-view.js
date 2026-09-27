// Log tab: pick a form, fill it (draft kept on every change), save -> queue -> Shortcut.

import { FORMS, SESSION_FORMS, renderFields, initialValues, missing, toEventFields } from "./forms.js";
import { buildEvent, toMarkdown } from "../lib/events.js";
import { weekStart, weekday } from "../lib/progress.js";
import { describeWarning } from "../lib/warnings.js";
import * as store from "../lib/store.js";
import * as queue from "../lib/queue.js";
import * as bridge from "../lib/bridge.js";
import { esc, longDate, shortDate, timeAgo } from "./format.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const BOULDER_TYPES = ["volume", "power_endurance", "limit", "project", "technique"];
const TODAY_FORM = { 0: "volume", 1: "home", 3: "power_endurance", 4: "home", 5: "limit" };
const CARD_NOTE = { volume: "Mon", power_endurance: "Thu", limit: "Sat", home: "Tue, Fri", morning: "every day", other: "rope, technique, rehab" };

// env: { data, today, route, go(hash), modelWith(events), refresh() }
export async function renderLog(root, env) {
  const [screen, arg] = env.route;
  if (screen && FORMS[screen]) return renderForm(root, env, FORMS[screen]);
  if (screen === "saved") return renderSaved(root, env, arg);
  return renderHome(root, env);
}

// ---------- home ----------
async function renderHome(root, env) {
  const wd = weekday(env.today);
  const suggested = TODAY_FORM[wd];
  const drafts = {};
  for (const id of Object.keys(FORMS)) drafts[id] = await store.get(`draft:${id}`);
  const list = await queue.all();

  const card = (id, primary) => {
    const f = FORMS[id];
    const d = drafts[id];
    const note = d ? `Draft · started ${new Date(d.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : CARD_NOTE[id];
    return `<a class="form-card${primary ? " primary" : ""}${d ? " has-draft" : ""}" href="#log/${id}">
      <span class="form-card-title">${esc(f.title)}</span><span class="form-card-note">${esc(note)}</span></a>`;
  };

  root.innerHTML = `
    <header class="screen-head"><div><h1>Log</h1><p class="sub">${esc(longDate(env.today))}</p></div></header>
    ${suggested ? `<section><h2>Today · ${DAY_NAMES[wd]}</h2>${card(suggested, true)}</section>` : `<section><h2>Today · ${DAY_NAMES[wd]}</h2><p class="muted">Rest day - no bouldering planned.</p></section>`}
    <section>
      <h2>All forms</h2>
      <div class="form-grid">${["morning", "volume", "power_endurance", "limit", "home", "other"].filter((id) => id !== suggested).map((id) => card(id)).join("")}</div>
    </section>
    <section>
      <h2>Recent logs</h2>
      ${list.length ? `<article class="card list">${list.map(queueRow).join("")}</article>` : `<p class="muted">Nothing logged in the app yet.</p>`}
    </section>`;

  root.querySelectorAll("[data-send]").forEach((b) => b.addEventListener("click", () => resend(b.dataset.send, env)));
  root.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => share(b.dataset.share)));
  root.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this log from the phone? It is not on the Mac yet.")) return;
      await queue.remove(b.dataset.delete);
      env.refresh();
    })
  );
}

const STATUS = {
  processed: ["ok", "On the Mac"],
  sent: ["wait", "Sent - waiting for the Mac"],
  saved: ["todo", "Not sent yet"],
};

function queueRow(e) {
  const [cls, label] = STATUS[e.status] || STATUS.saved;
  const when = e.status === "sent" ? ` · ${timeAgo(e.sentAt)}` : "";
  const actions =
    e.status === "processed"
      ? ""
      : `<div class="row-actions">
          <button class="chip" data-send="${esc(e.event.id)}">Send again</button>
          <button class="chip" data-share="${esc(e.event.id)}">Share file</button>
          <button class="chip danger" data-delete="${esc(e.event.id)}">Delete</button>
        </div>`;
  return `<div class="list-row queue-row">
      <div>
        <div class="list-name">${esc(e.title)}</div>
        <div class="list-sub"><span class="badge badge-${cls}">${esc(label)}</span>${esc(when)}</div>
        ${actions}
      </div>
    </div>`;
}

async function findEntry(id) {
  return (await queue.all()).find((e) => e.event.id === id);
}

async function resend(id, env) {
  const e = await findEntry(id);
  if (!e) return;
  await queue.markSent(id);
  await bridge.sendViaShortcut(e);
  setTimeout(env.refresh, 500);
}

async function share(id) {
  const e = await findEntry(id);
  if (!e) return;
  try {
    await bridge.shareFile(e);
    await queue.markSent(id);
  } catch (err) {
    if (err.name !== "AbortError") alert(err.message);
  }
}

// ---------- form ----------
function lastValue(data, form, name, from) {
  if (!data) return null;
  let rows;
  if (from === "dailies") rows = data.dailies || [];
  else {
    const types = form.sessionType ? [form.sessionType] : form.id === "limit" ? ["limit", "project"] : [];
    rows = (data.sessions || []).filter((s) => types.includes(s.type));
  }
  const hit = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)).find((r) => r[name] !== null && r[name] !== undefined && r[name] !== "");
  return hit ? String(hit[name]) : null;
}

function dayWarnings(form, values, data) {
  const out = [];
  const date = values.date;
  if (!date) return out;
  const wd = weekday(date);
  const type = form.sessionType || values.type;
  const isBoulder = form.kind === "session" && BOULDER_TYPES.includes(type);
  if (isBoulder && ![0, 3, 5].includes(wd)) out.push(`${DAY_NAMES[wd]} is not a bouldering day (Mon, Thu, Sat).`);
  if (isBoulder && data) {
    const week = weekStart(date);
    const days = new Set((data.sessions || []).filter((s) => BOULDER_TYPES.includes(s.type) && weekStart(s.date) === week && s.date !== date).map((s) => s.date));
    if (days.size >= 3) out.push(`This would be bouldering day ${days.size + 1} this week - the limit is 3.`);
  }
  if (form.kind === "session" && FORMS[form.id].day !== undefined && FORMS[form.id].day !== wd && [0, 3, 5].includes(wd)) {
    out.push(`${DAY_NAMES[wd]} usually has a different session - check the form.`);
  }
  return out;
}

async function renderForm(root, env, form) {
  const key = `draft:${form.id}`;
  let draft = await store.get(key);
  if (!draft) draft = { startedAt: new Date().toISOString(), values: initialValues(form, env.today) };
  const values = draft.values;
  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => store.set(key, { ...draft, values }), 250);
  };

  const projects = (env.data?.projects || []).filter((p) => p.status !== "sent").map((p) => p.file);
  root.innerHTML = `
    <header class="form-head">
      <a class="back" href="#log">&lsaquo; Log</a>
      <h1>${esc(form.title)}</h1>
      <div class="form-warnings" aria-live="polite"></div>
    </header>
    <form class="log-form" novalidate></form>
    <div class="save-bar">
      <div class="save-error" role="alert" hidden></div>
      <button class="btn" type="button" data-action="save">Save &amp; send</button>
      <button class="btn-link" type="button" data-action="discard">Discard draft</button>
    </div>`;

  const warningsBox = root.querySelector(".form-warnings");
  const paintWarnings = () => {
    warningsBox.innerHTML = dayWarnings(form, values, env.data)
      .map((w) => `<div class="alert alert-warning"><span class="alert-icon" aria-hidden="true">!</span><span>${esc(w)}</span></div>`)
      .join("");
  };
  const ctx = {
    startedAt: draft.startedAt,
    projects,
    get: (name) => values[name],
    set: (name, value) => {
      values[name] = value;
      persist();
      if (name === "date" || name === "type") paintWarnings();
    },
    last: (name, from) => lastValue(env.data, form, name, from),
  };
  root.querySelector(".log-form").append(renderFields(form, ctx));
  paintWarnings();
  if (!(await store.get(key))) await store.set(key, draft);

  root.querySelector("[data-action=discard]").addEventListener("click", async () => {
    if (!confirm("Discard this draft?")) return;
    clearTimeout(timer);
    await store.set(key, null);
    env.go("#log");
  });

  root.querySelector("[data-action=save]").addEventListener("click", async () => {
    const error = root.querySelector(".save-error");
    const miss = missing(form, values);
    if (miss.length) {
      error.textContent = `Missing: ${miss.join(", ")}`;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    clearTimeout(timer);
    const { kind, date, fields, body } = toEventFields(form, values);
    const ev = buildEvent(kind, date, fields);
    const md = toMarkdown(ev, body);
    const changes = diffModels(env.modelWith([]), env.modelWith([ev]));
    await queue.add({ event: ev, file: md.file, content: md.content, title: `${form.title} · ${shortDate(date)}` });
    await store.set(key, null);
    await store.set("lastSaved", { id: ev.id, changes });
    await queue.markSent(ev.id);
    env.go(`#log/saved/${ev.id}`);
    await bridge.sendViaShortcut(md);
  });
}

// ---------- saved ----------
async function renderSaved(root, env, id) {
  const e = await findEntry(id);
  const last = await store.get("lastSaved");
  const changes = last && last.id === id ? last.changes : [];
  const name = await bridge.shortcutName();
  if (!e) return env.go("#log");
  const [cls, label] = STATUS[e.status] || STATUS.saved;
  root.innerHTML = `
    <header class="screen-head"><h1>Saved</h1></header>
    <article class="card saved-card">
      <div class="saved-icon" aria-hidden="true">&#10003;</div>
      <h2 class="saved-title">${esc(e.title)}</h2>
      <p><span class="badge badge-${cls}">${esc(label)}</span></p>
      <p class="muted small">Handed to the Shortcut "${esc(name)}". The Mac turns it into a note once iCloud has synced - the log stays on this phone until then.</p>
    </article>
    ${
      changes.length
        ? `<section><h2>New in your progress</h2><article class="card list">${changes
            .map((c) => `<div class="list-row"><div class="list-name">${esc(c)}</div></div>`)
            .join("")}</article></section>`
        : ""
    }
    <button class="btn" data-action="done">Done</button>
    <button class="btn-secondary" data-send="${esc(id)}">Send again</button>
    <button class="btn-secondary" data-share="${esc(id)}">Share file instead</button>`;
  root.querySelector("[data-action=done]").addEventListener("click", () => env.go("#log"));
  root.querySelector("[data-send]").addEventListener("click", () => resend(id, env));
  root.querySelector("[data-share]").addEventListener("click", () => share(id));
}

// What a new log changes in the progress model - shown right after saving.
export function diffModels(before, after) {
  if (!before || !after) return [];
  const out = [];
  for (const key of ["kilter", "element", "oap"]) {
    const b = before.goals[key];
    const a = after.goals[key];
    a.steps.forEach((s, i) => {
      if (s.done && !b.steps[i]?.done) out.push(`${a.title || key}: ${s.key} reached`);
    });
  }
  const kc = [before.goals.kilter.counts, after.goals.kilter.counts];
  for (const [k, label] of [["v8", "V8"], ["v7", "V7"], ["v6", "V6"]]) if (kc[1][k] > kc[0][k]) out.push(`Kilter ${label} sends: ${kc[0][k]} → ${kc[1][k]}`);
  const ec = [before.goals.element.counts, after.goals.element.counts];
  for (const [k, label] of [["l9", "level 9"], ["l8", "level 8"]]) if (ec[1][k] > ec[0][k]) out.push(`Element ${label} sends: ${ec[0][k]} → ${ec[1][k]}`);
  const best = (m) => Math.max(-Infinity, ...m.pullUp.filter((p) => p.test).map((p) => p.kg));
  if (best(after) > best(before)) out.push(`New 3RM: ${best(after) > 0 ? "+" : ""}${best(after)} kg`);
  if (after.block && before.block && after.block.sessions.actual > before.block.sessions.actual) {
    out.push(`${after.block.name}: ${after.block.sessions.actual} / ${after.block.sessions.target} sessions`);
  }
  const codes = new Set(before.warnings.map((w) => w.code + (w.date || "")));
  for (const w of after.warnings) {
    if (codes.has(w.code + (w.date || ""))) continue;
    const t = describeWarning(w, shortDate);
    if (t) out.push(`${t.level === "critical" ? "Warning: " : ""}${t.title} ${t.text}`);
  }
  return out;
}

export { SESSION_FORMS };
