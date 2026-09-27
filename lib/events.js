// Building app events (see 99_Meta/App/Event Format.md) and writing them as Markdown files.

const pad = (n) => String(n).padStart(2, "0");

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Drops empty values, so "not done" stays empty in the note (never 0 by accident).
function clean(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

export function buildEvent(kind, date, fields, now = new Date()) {
  return { event: kind, id: newId(), created: now.toISOString(), date, ...clean(fields) };
}

// Strings as JSON strings (valid YAML), numbers and booleans plain, lists inline.
export function toMarkdown(ev, body = "") {
  const lines = Object.entries(ev).map(([k, v]) => `${k}: ${typeof v === "number" || typeof v === "boolean" ? v : JSON.stringify(v)}`);
  const t = new Date(ev.created);
  const stamp = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}-${pad(t.getMinutes())}-${pad(t.getSeconds())}`;
  return {
    // Part of the id keeps two events from the same second apart.
    file: `${stamp} ${ev.event} ${String(ev.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8)}.md`,
    content: `---\n${lines.join("\n")}\n---\n${body ? `${body.trim()}\n` : ""}`,
  };
}
