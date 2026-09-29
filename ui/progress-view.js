// Progress screen: the content of 01_Dashboard/Progress.md, computed by lib/progress.js.

import { esc, inline, plain, shortDate, longDate, timeAgo } from "./format.js";
import { lineChart, barChart } from "./charts.js";
import { describeWarning } from "../lib/warnings.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ICON = { critical: "!", warning: "!", info: "i" };

export function renderEmpty(root, onSync) {
  root.innerHTML = `
    <header class="screen-head"><h1>Progress</h1></header>
    <article class="card empty-card">
      <h2>No data yet</h2>
      <p>Import the data file from your vault once. Tap the button and pick
      <strong>iCloud Drive &rsaquo; Documents &rsaquo; Bouldering &rsaquo; 00_Inbox &rsaquo; App &rsaquo; app-data.json</strong>.</p>
      <p class="muted">The Mac writes this file every time Claude logs a session.</p>
      <button class="btn" data-action="sync">Sync from iCloud</button>
    </article>`;
  root.querySelector("[data-action=sync]").addEventListener("click", onSync);
}

export function renderProgress(root, model, meta, onSync) {
  const { kilter, element, oap } = model.goals;
  root.innerHTML = `
    <header class="screen-head">
      <div>
        <h1>Progress</h1>
        <p class="sub">Data from ${esc(longDate(model.updated))} · file from ${esc(timeAgo(meta.fileCreated))} · synced ${esc(timeAgo(meta.importedAt))}${
          meta.pending ? ` · <a href="#log">${meta.pending} ${meta.pending === 1 ? "log" : "logs"} not on the Mac yet</a>` : ""
        }</p>
      </div>
      <button class="btn-small" data-action="sync">Sync</button>
    </header>
    ${warnings(model.warnings)}
    <section>
      <h2>Goals</h2>
      ${goalCard(kilter, `Total sends: V7 <strong>${kilter.counts.v7}</strong> · V6 <strong>${kilter.counts.v6}</strong>${kilter.counts.v8 ? ` · V8 <strong>${kilter.counts.v8}</strong>` : ""}`)}
      ${goalCard(element, `Since ${esc(shortDate(element.since))}: level 9 <strong>${element.counts.l9}</strong> · level 8 <strong>${element.counts.l8}</strong>`)}
      ${goalCard(oap, oap.stage === null ? "Stage not set yet - after the 3RM test." : `Completed stage: <strong>${oap.stage}</strong> of 6`)}
      <article class="card">
        <h3>Kilter grade pyramid</h3>
        <p class="sub">All sends at 40 degrees</p>
        <div data-chart="pyramid"></div>
      </article>
    </section>
    ${block(model.block, model.today)}
    <section>
      <h2>Strength</h2>
      <article class="card">
        <h3>Weighted pull-up</h3>
        <p class="sub">Added weight per session</p>
        <div data-chart="pullup"></div>
      </article>
      ${rows(model.strength, "Target")}
    </section>
    <section>
      <h2>Body</h2>
      ${rows(model.body, "Target")}
      <article class="card">
        <h3>Finger pain</h3>
        <p class="sub">0-10 · limits: 2 during training, 3 the next day</p>
        <div data-chart="finger"></div>
      </article>
      <article class="card">
        <h3>Groin</h3>
        <p class="sub">0-10 · limit 2 during exercises, stretch pain goal below 3</p>
        <div data-chart="groin"></div>
      </article>
    </section>
    <section>
      <h2>Milestones</h2>
      <article class="card">
        <ol class="timeline">
          ${model.milestones.map((m) => `<li><span class="timeline-date">${esc(shortDateOrMonth(m.date))}</span><span>${inline(m.text)}</span></li>`).join("")}
        </ol>
      </article>
    </section>`;

  root.querySelector("[data-action=sync]").addEventListener("click", onSync);
  charts(root, model);
}

// ---------- pieces ----------
function warnings(list) {
  if (!list.length) return "";
  return `<div class="alerts">${list
    .map((w) => {
      const t = describeWarning(w, shortDate);
      if (!t) return "";
      return `<div class="alert alert-${t.level}" role="status"><span class="alert-icon" aria-hidden="true">${ICON[t.level]}</span><span><strong>${esc(t.title)}</strong> ${esc(t.text)}</span></div>`;
    })
    .join("")}</div>`;
}

function meter(value, max, label) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${pct}%"></span></div>`;
}

function goalCard(goal, countsHtml) {
  const next = goal.steps.findIndex((s) => !s.done);
  return `
    <article class="card goal">
      <div class="goal-head">
        <h3>${esc(plain(goal.title))}</h3>
        <span class="goal-count">${goal.reached} / ${goal.max}</span>
      </div>
      ${meter(goal.reached, goal.max, plain(goal.title))}
      ${goal.statusText ? `<p class="goal-status">${inline(goal.statusText)}</p>` : ""}
      <ol class="ladder">
        ${goal.steps
          .map((s, i) => {
            const cls = s.done ? "done" : i === next ? "next" : "";
            const state = s.done ? "done" : i === next ? "next step" : "open";
            return `<li class="${cls}"><span class="step-icon" aria-label="${state}">${s.done ? "&#10003;" : ""}</span><span>${inline(s.text)}</span></li>`;
          })
          .join("")}
      </ol>
      <p class="goal-counts">${countsHtml}</p>
      ${goal.nextStep ? `<p class="next-step"><span class="label">Next step</span>${inline(goal.nextStep)}</p>` : ""}
    </article>`;
}

function weekText(b) {
  if (b.phase === "upcoming") return b.daysUntilStart === 1 ? "starts tomorrow" : `starts in ${b.daysUntilStart} days`;
  if (b.phase === "done") return "completed";
  return `week ${b.week} of ${b.weeks}${b.deload ? " · deload" : ""}`;
}

const TARGET_LABEL = { boulder: "Bouldering days", home: "At home (Tue, Fri)", testday: "Testday" };

function block(b, today) {
  if (!b) return "";
  const tiles = b.targets
    .map(
      (t) => `
      <div class="tile">
        <span class="tile-label">${TARGET_LABEL[t.id]}</span>
        <span class="tile-value">${t.actual}<span class="tile-of"> / ${t.target}</span></span>
        ${meter(t.actual, t.target, TARGET_LABEL[t.id])}
      </div>`
    )
    .join("");
  return `
    <section>
      <h2>Current block</h2>
      <article class="card">
        <h3>${esc(plain(b.name))}</h3>
        <p class="sub">${esc(shortDate(b.start))} - ${esc(shortDate(b.end))} · ${esc(weekText(b))}${b.focus ? ` · ${esc(b.focus)}` : ""}</p>
        <div class="tiles">${tiles}</div>
        ${calendar(b, today)}
      </article>
    </section>`;
}

function calendar(b, today) {
  // Empty cells before the first day, so a block that starts mid-week still lines up.
  const offset = b.calendar.length ? b.calendar[0].weekday : 0;
  const blanks = '<div class="cal-cell blank" aria-hidden="true"></div>'.repeat(offset);
  const cells = blanks + b.calendar
    .map((c) => {
      let state = "rest";
      let mark = "";
      let text = "rest day";
      const boulder = c.sessions.length > 0;
      if (c.planned === "boulder") {
        if (boulder) [state, mark, text] = ["done", "&#10003;", `bouldering done (${c.sessions.map((s) => s.type).join(", ")})`];
        else if (c.date < today) [state, mark, text] = ["missed", "&ndash;", "bouldering planned, not logged"];
        else [state, mark, text] = ["planned", "", "bouldering planned"];
      } else if (boulder) {
        [state, mark, text] = ["extra", "!", `session on an unplanned day (${c.sessions.map((s) => s.type).join(", ")})`];
      } else if (c.planned === "home") {
        if (c.home) [state, mark, text] = ["home-done", "&#10003;", "home training done"];
        else if (c.date < today) [state, mark, text] = ["home-missed", "H", "home training planned, not logged"];
        else [state, mark, text] = ["home", "H", "home training planned"];
      }
      if (c.test) text += ", testday";
      const cls = ["cal-cell", state, c.date === today ? "today" : ""].join(" ");
      const day = Number(c.date.slice(8));
      return `<div class="${cls}" role="listitem" aria-label="${esc(longDate(c.date))}: ${esc(text)}" title="${esc(text)}"><span class="cal-day">${day}</span><span class="cal-mark" aria-hidden="true">${mark}</span></div>`;
    })
    .join("");
  return `
    <div class="calendar">
      <div class="cal-head" aria-hidden="true">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid" role="list">${cells}</div>
      <div class="cal-legend" aria-hidden="true">
        <span><i class="cal-key done">&#10003;</i>Done</span>
        <span><i class="cal-key planned"></i>Planned</span>
        <span><i class="cal-key missed">&ndash;</i>Missed</span>
        <span><i class="cal-key home">H</i>Home</span>
        <span><i class="cal-key extra">!</i>Extra day</span>
      </div>
    </div>`;
}

function rows(list, targetLabel) {
  if (!list.length) return "";
  return `
    <article class="card list">
      ${list
        .map((r) => {
          const last = r.entries?.length ? r.entries.at(-1).date : null;
          const sub = [
            r.target && r.target !== "-" ? `${targetLabel}: ${inline(r.target)}` : "",
            last ? `last ${esc(shortDate(last))}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return `
          <div class="list-row">
            <div>
              <div class="list-name">${esc(r.name)}</div>
              ${sub ? `<div class="list-sub">${sub}</div>` : ""}
            </div>
            <div class="list-value">${inline(r.current || "?")}</div>
          </div>`;
        })
        .join("")}
    </article>`;
}

// Milestones span years, so they always show the year.
const shortDateOrMonth = (d) => {
  if (/^\d{4}-\d{2}$/.test(d)) return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(`${d}-01T00:00:00`));
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
  return d;
};

// ---------- charts ----------
function charts(root, model) {
  const chart = (name) => root.querySelector(`[data-chart=${name}]`);

  const dist = model.goals.kilter.distribution || {};
  const grades = Object.keys(dist).map(Number);
  const low = grades.length ? Math.min(...grades) : 3;
  const bars = [];
  for (let v = Math.max(8, ...grades); v >= low; v--) bars.push({ label: `V${v}`, value: dist[v] || 0 });
  barChart(chart("pyramid"), { bars, name: "Sends", emptyText: "No Kilter sends yet." });

  const pullRow = model.strength.find((r) => /^Weighted Pull-Up/i.test(r.name));
  const target = pullRow && String(pullRow.target).match(/\+(\d+(?:\.\d+)?)\s*kg/i);
  const kg = (v) => `${v > 0 ? "+" : ""}${v} kg`;
  lineChart(chart("pullup"), {
    label: "Weighted pull-up, added weight",
    series: [{ name: "Added weight", color: "--series-1", points: model.pullUp.map((p) => ({ date: p.date, value: p.kg, text: p.text })) }],
    format: kg,
    minMax: target ? Number(target[1]) : 20,
    thresholds: target ? [{ value: Number(target[1]), label: `target ${kg(Number(target[1]))}` }] : [],
    emptyText: "No weighted pull-ups logged yet - the 3RM test comes first.",
  });

  const pick = (field) =>
    model.pain.filter((d) => typeof d[field] === "number").map((d) => ({ date: d.date, value: d[field], text: `${d[field]}/10` }));
  const end = model.today > model.updated ? model.today : model.updated;
  lineChart(chart("finger"), {
    label: "Finger pain",
    series: [
      { name: "During training", color: "--series-1", points: pick("finger_session") },
      { name: "Next day", color: "--series-2", points: pick("finger_next_day_prev") },
      { name: "Morning", color: "--series-3", points: pick("finger_morning") },
    ],
    thresholds: [
      { value: 2, label: "limit 2" },
      { value: 3, label: "limit next day 3" },
    ],
    end,
    emptyText: "No finger pain values yet.",
  });
  // Stretch values come from the Body row, which also holds the history written by hand.
  const groinRow = model.body.find((r) => /^Groin/i.test(r.name));
  const stretch = (groinRow?.entries || [])
    .filter((e) => /^\d+(\.\d+)?$/.test(e.value))
    .map((e) => ({ date: e.date, value: Number(e.value), text: `${e.value}/10` }));
  lineChart(chart("groin"), {
    label: "Groin pain",
    series: [
      { name: "During training", color: "--series-1", points: pick("groin_session") },
      { name: "Stretch test", color: "--series-2", points: stretch },
      { name: "Adductor exercises", color: "--series-3", points: pick("groin_home") },
    ],
    thresholds: [
      { value: 2, label: "limit 2" },
      { value: 3, label: "stretch goal below 3" },
    ],
    end,
    emptyText: "No groin values yet - they come with the next session or stretch test.",
  });
}
