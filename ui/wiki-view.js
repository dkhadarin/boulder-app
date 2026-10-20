// Wiki tab: the vault's notes, rendered and read-only. They arrive with app-data.json
// (field "wiki"); links between notes stay inside the app.

import { buildIndex, noteHref, folderLabel } from "../lib/wiki.js";
import { renderInline } from "../lib/markdown.js";
import * as store from "../lib/store.js";
import { esc } from "./format.js";

const indexes = new WeakMap();
const indexFor = (notes) => {
  if (!indexes.has(notes)) indexes.set(notes, buildIndex(notes));
  return indexes.get(notes);
};

let query = "";
// Wiki screens visited in a row - the back button only uses history.back() inside it.
let trail = [];
export const leaveWiki = () => (trail = []);

export async function renderWiki(root, { appData, route, go }) {
  const notes = appData?.wiki;
  if (!notes?.length) {
    root.innerHTML = `<header class="screen-head"><h1>Wiki</h1></header>
      <article class="card empty-card"><h2>No notes yet</h2><p>${
        appData ? "The data file has no notes yet - sync again after the Mac has updated it." : "Sync the data file on the Dashboard tab first."
      }</p></article>`;
    return;
  }
  const hash = location.hash || "#wiki";
  if (trail.at(-2) === hash) trail.pop();
  else if (trail.at(-1) !== hash) trail.push(hash);

  const index = indexFor(notes);
  if (route[0] === "note") return renderNote(root, index, route[1], route[2], go);
  return renderHome(root, index);
}

// ---------- start: search + folders ----------
const chevron = `<span class="wiki-chevron" aria-hidden="true">&rsaquo;</span>`;
const noteRow = (d) => `<a class="list-row wiki-row" href="${esc(noteHref(d.path))}"><span class="list-name">${esc(d.name)}</span>${chevron}</a>`;

async function renderHome(root, index) {
  const open = new Set((await store.get("wikiFolders")) || []);
  root.innerHTML = `
    <header class="screen-head"><div><h1>Wiki</h1><p class="sub">${index.size} notes from Obsidian · read-only</p></div></header>
    <div class="wiki-search">
      <input type="search" class="field-input" placeholder="Search notes" aria-label="Search notes" value="${esc(query)}"
        enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    </div>
    <div class="wiki-body"></div>`;
  const input = root.querySelector("input");
  const body = root.querySelector(".wiki-body");

  const browse = () => {
    const home = index.get("01_Dashboard/Home");
    const start = home
      ? `<a class="card wiki-start" href="${esc(noteHref(home.path))}"><span><span class="list-name">${esc(home.title)}</span>
         <span class="list-sub">Start page of the vault</span></span>${chevron}</a>`
      : "";
    const groups = index
      .tree()
      .map(
        (g) => `<details class="card wiki-folder" data-folder="${esc(g.folder)}"${open.has(g.folder) ? " open" : ""}>
          <summary><span class="wiki-folder-name">${esc(g.label)}</span><span class="chip-count">${g.count}</span></summary>
          <div class="list">
            ${g.notes.map(noteRow).join("")}
            ${g.subs.map((s) => `<div class="wiki-sub">${esc(s.label)}</div>${s.notes.map(noteRow).join("")}`).join("")}
          </div>
        </details>`
      )
      .join("");
    body.innerHTML = start + groups;
    body.querySelectorAll("details[data-folder]").forEach((d) =>
      d.addEventListener("toggle", () => {
        if (d.open) open.add(d.dataset.folder);
        else open.delete(d.dataset.folder);
        store.set("wikiFolders", [...open]);
      })
    );
  };

  const results = () => {
    const hits = index.search(query);
    if (!hits.length) {
      body.innerHTML = `<article class="card"><p class="muted">No note contains “${esc(query.trim())}”.</p></article>`;
      return;
    }
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    // Hits are found in the raw text, then escaped piece by piece.
    const mark = (text) => {
      const lower = text.toLowerCase();
      const ranges = [];
      for (const t of terms) for (let i = lower.indexOf(t); i >= 0; i = lower.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
      let html = "";
      let pos = 0;
      for (const [s, e] of ranges.sort((a, b) => a[0] - b[0])) {
        if (s < pos) continue;
        html += `${esc(text.slice(pos, s))}<mark>${esc(text.slice(s, e))}</mark>`;
        pos = e;
      }
      return html + esc(text.slice(pos));
    };
    body.innerHTML = `<p class="muted small wiki-count">${hits.length === 40 ? "First 40" : hits.length} ${hits.length === 1 ? "note" : "notes"}</p>
      <article class="card list">${hits
        .map(
          (h) => `<a class="list-row wiki-row" href="${esc(noteHref(h.path))}"><span class="wiki-hit">
            <span class="list-name">${mark(h.title)}</span>
            <span class="list-sub">${esc(folderLabel(h.folder))}</span>
            <span class="wiki-snippet">${mark(h.snippet)}</span></span>${chevron}</a>`
        )
        .join("")}</article>`;
  };

  const paint = () => (query.trim() ? results() : browse());
  input.addEventListener("input", () => {
    query = input.value;
    paint();
  });
  paint();
}

// ---------- one note ----------
function propValue(v, link) {
  if (v === true) return "✓";
  if (v === false) return `<span class="muted">–</span>`;
  if (Array.isArray(v)) return v.map((x) => propValue(x, link)).join(", ");
  return renderInline(String(v), link);
}

function renderNote(root, index, path, heading, go) {
  const note = index.render(path);
  if (!note) return go("#wiki");
  const props = Object.entries(note.fm).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  root.innerHTML = `
    <header class="form-head">
      <a class="back" href="#wiki" data-back>&lsaquo; Back</a>
      <h1>${esc(note.title)}</h1>
      ${note.folder ? `<p class="sub">${esc(folderLabel(note.folder))}</p>` : ""}
    </header>
    ${
      props.length
        ? `<details class="card props"><summary>Properties <span class="chip-count">${props.length}</span></summary>
            <div class="list">${props
              .map(([k, v]) => `<div class="list-row"><div class="list-name">${esc(k)}</div><div class="prop-value">${propValue(v, note.link)}</div></div>`)
              .join("")}</div></details>`
        : ""
    }
    <article class="md">${note.html}</article>
    ${note.backlinks.length ? `<section><h2>Linked from</h2><article class="card list">${note.backlinks.map(noteRow).join("")}</article></section>` : ""}
    <p class="muted small">In the vault: ${esc(note.path)}.md</p>`;

  root.querySelector("[data-back]").addEventListener("click", (ev) => {
    ev.preventDefault();
    if (trail.length > 1) history.back();
    else go("#wiki");
  });
  if (heading) document.getElementById(`h-${heading}`)?.scrollIntoView();
}
