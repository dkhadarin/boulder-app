// Small text helpers. Vault text is escaped first, then the two bits of Markdown
// the Progress page uses (**bold**, [[links]]) are turned into HTML.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const unlink = (s) => s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");

export const inline = (md) => unlink(esc(md)).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
export const plain = (md) => unlink(String(md ?? "")).replace(/\*\*/g, "");

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const asDate = (iso) => new Date(`${iso}T00:00:00`);

export const shortDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? SHORT.format(asDate(iso)) : iso);
export const longDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? LONG.format(asDate(iso)) : iso);

export function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeAgo(isoTime) {
  if (!isoTime) return "never";
  const minutes = Math.round((Date.now() - new Date(isoTime).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
