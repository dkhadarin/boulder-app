// Sessions tab: the Obsidian .base tables (Sessions.base, Routines.base) on the phone.

import { tables, value } from "../lib/bases.js";
import * as store from "../lib/store.js";
import { esc, inline, shortDate, longDate } from "./format.js";

const LABELS = {
  "file.name": "Session",
  type: "Type",
  date: "Date",
  feeling: "Feeling",
  duration: "Min",
  rpe: "RPE",
  finger_pain: "Finger",
  finger_pain_next_day: "Finger +1d",
  groin_pain: "Groin",
  boulder_count: "Boulders",
  pull_up: "Pull-up",
  toes_to_bar: "Toes-to-bar",
  front_lever: "Front lever",
  push_ups: "Push-ups",
  interval_rounds: "Rounds",
  interval_levels: "Levels",
  pallof: "Pallof",
  kilter_v8: "Kilter V8",
  kilter_v7: "Kilter V7",
  kilter_v6: "Kilter V6",
  element_9: "Element 9",
  element_8: "Element 8",
  project: "Project",
  lying_leg_raises: "Leg raises",
  ab_wheel: "Ab wheel",
  location: "Where",
  week: "Week",
  top_grade: "Top grade",
  finger_prehab: "Prehab",
  adductors: "Adductors",
  adductors_detail: "Adductors detail",
  adductors_pain: "Groin (add.)",
  mobility: "Mobility",
  running: "Running",
  other: "Other",
  sleep: "Sleep",
  groin_stretch_pain: "Groin stretch",
};
// In the detail view there is room for the full names.
const DETAIL_LABELS = {
  duration: "Duration (min)",
  finger_pain: "Finger pain",
  finger_pain_next_day: "Finger pain next day",
  groin_pain: "Groin pain",
  adductors_pain: "Groin pain (adductor exercises)",
  groin_stretch_pain: "Groin stretch pain",
  interval_rounds: "Interval rounds",
  interval_levels: "Interval levels",
  sleep: "Sleep (h)",
  running: "Running (min)",
};
const PAIN = { finger_pain: 2, groin_pain: 2, adductors_pain: 2, finger_pain_next_day: 3, groin_stretch_pain: 3 };
const HIDDEN = new Set(["file", "tags", "example", "pending", "notes", "block"]);
const TYPE_NAMES = { volume: "Volume", power_endurance: "Power Endurance", limit: "Limit", project: "Project", route: "Rope", technique: "Technique", rehab: "Rehab", daily: "Daily" };

const label = (key) => LABELS[key] || key.replace(/^note\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function cell(key, v) {
  if (v === null || v === undefined || v === "") return `<span class="muted">–</span>`;
  if (v === true) return "✓";
  if (v === false) return `<span class="muted">–</span>`;
  if (key in PAIN && typeof v === "number" && v > PAIN[key]) return `<strong class="over">! ${v}</strong>`;
  if (key === "type") return esc(TYPE_NAMES[v] || v);
  return esc(v);
}

// First column: date big, rest of the note name small.
function nameCell(rec) {
  const m = String(rec.file).match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
  const date = m ? shortDate(m[1]) : rec.file;
  const rest = m ? m[2].replace(/\(not synced yet\)/, "").trim() || TYPE_NAMES[rec.type] || "" : "";
  return `<span class="name-date">${esc(date)}</span>${rest ? `<span class="name-rest">${esc(rest)}</span>` : ""}${rec.pending ? `<span class="name-pending">not on the Mac yet</span>` : ""}`;
}

export async function renderSessions(root, { data, route, go }) {
  if (!data) {
    root.innerHTML = `<header class="screen-head"><h1>Sessions</h1></header>
      <article class="card empty-card"><h2>No data yet</h2><p>Sync the data file on the Progress tab first.</p></article>`;
    return;
  }
  const all = tables(data.bases, data);
  if (route[0] === "detail") return renderDetail(root, data, route.slice(1).join("/"), go);

  if (!all.length) {
    root.innerHTML = `<header class="screen-head"><h1>Sessions</h1></header>
      <article class="card empty-card"><h2>No tables</h2><p>The data file has no views from Sessions.base yet - sync again after the Mac has updated it.</p></article>`;
    return;
  }
  let current = (await store.get("sessionsView")) || all[0].id;
  if (!all.some((t) => t.id === current)) current = all[0].id;

  const paint = () => {
    const t = all.find((x) => x.id === current);
    const chips = all
      .map((x, i) => {
        const sep = i > 0 && all[i - 1].base !== x.base ? `<span class="chip-sep" aria-hidden="true"></span>` : "";
        return `${sep}<button class="chip" data-view="${esc(x.id)}" aria-pressed="${x.id === current}">${esc(x.name)} <span class="chip-count">${x.rows.length}</span></button>`;
      })
      .join("");
    const head = t.columns.map((c, i) => `<th scope="col"${i === 0 ? ' class="sticky"' : ""}>${esc(label(c))}</th>`).join("");
    const body = t.rows
      .map((r) => {
        const tds = t.columns
          .map((c, i) => (i === 0 ? `<th scope="row" class="sticky">${c === "file.name" ? nameCell(r) : cell(c, value(r, c))}</th>` : `<td>${cell(c, value(r, c))}</td>`))
          .join("");
        return `<tr tabindex="0" data-file="${esc(r.file)}"${r.pending ? ' class="pending"' : ""}>${tds}</tr>`;
      })
      .join("");
    root.innerHTML = `
      <header class="screen-head"><div><h1>Sessions</h1><p class="sub">The tables from Obsidian · tap a row for details</p></div></header>
      <div class="view-chips" role="toolbar" aria-label="Views">${chips}</div>
      ${
        t.rows.length
          ? `<div class="table-wrap"><table class="base-table"><caption class="visually-hidden">${esc(t.name)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
             <p class="muted small">${t.rows.length} ${t.rows.length === 1 ? "entry" : "entries"} · swipe the table sideways for more columns</p>`
          : `<article class="card"><p class="muted">Nothing here${t.name === "Pain warning" ? " - no pain above the limits" : ""}.</p></article>`
      }`;
    root.querySelectorAll("[data-view]").forEach((b) =>
      b.addEventListener("click", async () => {
        current = b.dataset.view;
        await store.set("sessionsView", current);
        paint();
      })
    );
    root.querySelectorAll("tr[data-file]").forEach((tr) => {
      const open = () => go(`#sessions/detail/${encodeURIComponent(tr.dataset.file)}`);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (ev) => ev.key === "Enter" && open());
    });
    const active = root.querySelector('.chip[aria-pressed="true"]');
    if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
  };
  paint();
}

function renderDetail(root, data, file, go) {
  const rec = [...(data.sessions || []), ...(data.dailies || [])].find((r) => r.file === file);
  if (!rec) return go("#sessions");
  const rows = Object.entries(rec)
    .filter(([k]) => !HIDDEN.has(k))
    .map(([k, v]) => `<div class="list-row"><div class="list-name">${esc(DETAIL_LABELS[k] || label(k))}</div><div class="list-value">${cell(k, v)}</div></div>`)
    .join("");
  const title = rec.date ? `${longDate(rec.date)}` : rec.file;
  root.innerHTML = `
    <header class="form-head">
      <a class="back" href="#sessions">&lsaquo; Sessions</a>
      <h1>${esc(TYPE_NAMES[rec.type] || rec.file)}</h1>
      <p class="sub">${esc(title)}${rec.pending ? " · not on the Mac yet" : ""}</p>
    </header>
    <article class="card list">${rows}</article>
    ${rec.notes?.length ? `<section><h2>Notes</h2><article class="card list">${rec.notes.map((n) => `<div class="list-row"><div>${inline(n)}</div></div>`).join("")}</article></section>` : ""}
    <p class="muted small">In the vault: ${esc(rec.type === "daily" ? `00_Inbox/Daily/${rec.file}.md` : `02_Training/Sessions/${rec.file}.md`)}</p>`;
}
