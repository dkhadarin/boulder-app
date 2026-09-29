// Obsidian .base views (01_Dashboard/Sessions.base, Routines.base) evaluated on the app data:
// filters (and / or / not, ==, !=, >, >=, <, <=), column order and sort - like the tables in Obsidian.

const FOLDERS = { "02_Training/Sessions": "sessions", "00_Inbox/Daily": "dailies" };

function literal(raw) {
  const s = raw.trim();
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

export function value(rec, key) {
  if (key === "file.name") return rec.file;
  return rec[key.replace(/^note\./, "")];
}

const empty = (v) => v === null || v === undefined || v === "";

function expr(text, rec) {
  if (/^file\.inFolder\(/.test(text)) return true; // the folder picks the records, see recordsOf
  const m = String(text).match(/^\s*([A-Za-z0-9_.]+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/);
  if (!m) return true; // unknown syntax: rather show the row than hide it
  const left = value(rec, m[1]);
  const right = literal(m[3]);
  switch (m[2]) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      if (empty(left) || typeof left !== typeof right) return false;
      if (m[2] === ">=") return left >= right;
      if (m[2] === "<=") return left <= right;
      if (m[2] === ">") return left > right;
      return left < right;
  }
}

export function matches(filter, rec) {
  if (filter === null || filter === undefined) return true;
  if (typeof filter === "string") return expr(filter, rec);
  if (Array.isArray(filter)) return filter.every((f) => matches(f, rec));
  if (filter.and) return filter.and.every((f) => matches(f, rec));
  if (filter.or) return filter.or.some((f) => matches(f, rec));
  if (filter.not) return !(Array.isArray(filter.not) ? filter.not : [filter.not]).some((f) => matches(f, rec));
  return true;
}

function folderOf(filter) {
  if (typeof filter === "string") {
    const m = filter.match(/file\.inFolder\("([^"]+)"\)/);
    return m ? m[1] : null;
  }
  if (!filter || typeof filter !== "object") return null;
  for (const part of Object.values(filter).flat()) {
    const f = folderOf(part);
    if (f) return f;
  }
  return null;
}

export function recordsOf(base, data) {
  const key = FOLDERS[folderOf(base?.filters)];
  return key ? data[key] || [] : [];
}

function compare(a, b) {
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1; // empty values last, like Obsidian
  if (empty(b)) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

// All views of all bases, as { id, base, name, columns, rows }.
export function tables(bases, data) {
  const out = [];
  for (const [baseId, base] of Object.entries(bases || {})) {
    if (!base?.views) continue;
    const records = recordsOf(base, data);
    base.views.forEach((view, i) => {
      if (view.type && view.type !== "table") return;
      const rows = records.filter((r) => matches(base.filters, r) && matches(view.filters, r));
      const sort = view.sort || [];
      rows.sort((a, b) => {
        for (const s of sort) {
          const c = compare(value(a, s.property), value(b, s.property));
          if (c) return String(s.direction).toUpperCase() === "DESC" ? -c : c;
        }
        return compare(value(b, "date"), value(a, "date")); // newest first when nothing else decides
      });
      out.push({ id: `${baseId}-${i}`, base: baseId, name: view.name || `View ${i + 1}`, columns: view.order || ["file.name"], rows });
    });
  }
  return out;
}
