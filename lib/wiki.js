// The vault's notes from app-data.json (field "wiki"): link resolution, backlinks,
// search and the folder tree for the Wiki tab. No DOM here - tested in Node.

import { renderMarkdown, wikiTargets, plainText, slug } from "./markdown.js";

// Notes that have their own screen in the app open that screen instead.
const SCREENS = { "01_Dashboard/Progress": "#progress" };
const BASE_SCREEN = "#sessions"; // [[Sessions.base]], [[Routines.base]]

export const noteHref = (path, heading) =>
  SCREENS[path] || `#wiki/note/${encodeURIComponent(path)}${heading ? `/${encodeURIComponent(slug(heading))}` : ""}`;

const nameOf = (path) => path.split("/").pop();
const folderOf = (path) => path.split("/").slice(0, -1).join("/");
// "02_Training/Training_Theory" -> "Training › Training Theory"
export const folderLabel = (folder) =>
  folder
    .split("/")
    .filter(Boolean)
    .map((p) => p.replace(/^\d+_/, "").replace(/_/g, " "))
    .join(" › ");

// The first "# Heading" is the page title; the rest is the page.
export function splitTitle(body) {
  const m = String(body).match(/^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/);
  return m ? { title: m[1], rest: body.slice(m[0].length) } : { title: null, rest: body };
}

const isDated = (name) => /^\d{4}-\d{2}-\d{2}/.test(name);
// Dated notes (sessions, dailies) newest first, everything else alphabetical.
function sortNotes(list) {
  const dated = list.length && list.every((n) => isDated(n.name));
  return [...list].sort((a, b) => (dated ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name, "en", { sensitivity: "base" })));
}

export function buildIndex(notes) {
  const docs = notes.map((n) => {
    const name = nameOf(n.path);
    const { title } = splitTitle(n.body || "");
    const text = plainText(n.body || "");
    return { path: n.path, name, title: title ? plainText(title) : name, folder: folderOf(n.path), fm: n.fm || {}, body: n.body || "", text };
  });
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const byName = new Map();
  for (const d of docs) if (!byName.has(d.name.toLowerCase())) byName.set(d.name.toLowerCase(), d.path);

  // "Note", "Folder/Note", "Note#Heading", "#Heading" (same note), "Sessions.base".
  function resolve(target, from) {
    const [rawName, rawHeading] = String(target).split("#");
    const name = rawName.trim().replace(/\.md$/i, "");
    const heading = rawHeading?.trim();
    if (!name) return from ? { href: noteHref(from, heading), path: from } : null;
    if (/\.base$/i.test(name)) return { href: BASE_SCREEN };
    const path = byPath.has(name) ? name : byName.get(nameOf(name).toLowerCase());
    return path ? { href: noteHref(path, heading), path } : null;
  }

  const backlinks = new Map();
  for (const d of docs) {
    const values = Object.values(d.fm).flat().filter((v) => typeof v === "string");
    for (const t of new Set([...wikiTargets(d.body), ...values.flatMap(wikiTargets)])) {
      const r = resolve(t);
      if (!r?.path || r.path === d.path) continue;
      if (!backlinks.has(r.path)) backlinks.set(r.path, new Set());
      backlinks.get(r.path).add(d.path);
    }
  }

  function render(path) {
    const d = byPath.get(path);
    if (!d) return null;
    const { title, rest } = splitTitle(d.body);
    const link = (t) => resolve(t, path);
    return {
      ...d,
      title: title || d.name,
      html: renderMarkdown(rest, { link }),
      link,
      backlinks: sortNotes([...(backlinks.get(path) || [])].map((p) => byPath.get(p))),
    };
  }

  // All terms must occur; the title counts most. Snippet around the first hit in the text.
  function search(query, limit = 40) {
    const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hits = [];
    for (const d of docs) {
      const head = `${d.title} ${d.name}`.toLowerCase();
      const text = d.text.toLowerCase();
      if (!terms.every((t) => head.includes(t) || text.includes(t) || d.folder.toLowerCase().includes(t))) continue;
      let score = 0;
      for (const t of terms) {
        if (head.includes(t)) score += 10;
        if (head.startsWith(t)) score += 5;
        score += Math.min(text.split(t).length - 1, 5);
      }
      hits.push({ ...d, score, snippet: snippet(d.text, text, terms) });
    }
    return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
  }

  // Top-level folders with their own notes and subfolders: [{ folder, label, notes, subs: [{ folder, label, notes }] }]
  function tree() {
    const groups = new Map();
    for (const d of docs) {
      const top = d.folder.split("/")[0];
      if (!groups.has(top)) groups.set(top, { folder: top, label: folderLabel(top) || "Vault", notes: [], subs: new Map() });
      const g = groups.get(top);
      if (d.folder === top) g.notes.push(d);
      else {
        if (!g.subs.has(d.folder)) g.subs.set(d.folder, { folder: d.folder, label: folderLabel(d.folder.slice(top.length + 1)), notes: [] });
        g.subs.get(d.folder).notes.push(d);
      }
    }
    return [...groups.values()]
      .sort((a, b) => a.folder.localeCompare(b.folder))
      .map((g) => ({
        ...g,
        notes: sortNotes(g.notes),
        subs: [...g.subs.values()].sort((a, b) => a.folder.localeCompare(b.folder)).map((s) => ({ ...s, notes: sortNotes(s.notes) })),
        count: g.notes.length + [...g.subs.values()].reduce((n, s) => n + s.notes.length, 0),
      }));
  }

  return { size: docs.length, get: (path) => byPath.get(path), resolve, render, search, tree };
}

function snippet(text, lower, terms) {
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return text.slice(0, 120) + (text.length > 120 ? "…" : "");
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 50)) + 1);
  const end = Math.min(text.length, at + 110);
  const cut = text.indexOf(" ", end);
  const stop = cut < 0 ? text.length : cut;
  return `${start > 0 ? "…" : ""}${text.slice(start, stop)}${stop < text.length ? "…" : ""}`;
}
