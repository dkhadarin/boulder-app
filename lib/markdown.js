// Markdown -> HTML for the Wiki tab. Covers what the vault uses: headings, paragraphs,
// nested and task lists, tables, quotes, rules, code, **bold** / *italic*, [[wikilinks]]
// and <progress>. Everything else that looks like HTML is escaped.
//
// link(target) resolves "Note#Heading" to { href } - or null for a note that doesn't exist.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Heading ids ("h-" + slug, so they can't clash with the app's own ids), also used for [[Note#Heading]] links.
export const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[*_`~=[\]]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

// Link targets in a text, without heading or alias: "[[A#x|y]]" -> "A".
export function wikiTargets(text) {
  return [...String(text).matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].split(/\\?\|/)[0].split("#")[0].trim()).filter(Boolean);
}

// Text without markup, for search and snippets.
export function plainText(md) {
  return String(md)
    .replace(/\[\[([^\]|]+?)(?:\\?\|([^\]]+))?\]\]/g, (_, t, alias) => alias || t)
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*#+\s+/gm, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/[*_`~=|>#]+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- inline ----------
function wikilink(raw, link) {
  const [target, alias] = raw.split(/\\?\|/);
  const [name, heading] = target.split("#").map((s) => s.trim());
  const label = alias?.trim() || (name ? (heading ? `${name} › ${heading}` : name) : heading || target);
  const to = link ? link(target.trim()) : null;
  return to ? `<a class="wikilink" href="${esc(to.href)}">${esc(label)}</a>` : `<span class="wikilink missing">${esc(label)}</span>`;
}

export function renderInline(text, link) {
  const keep = [];
  const hold = (html) => `\u0000${keep.push(html) - 1}\u0000`;
  let s = String(text)
    .replace(/`([^`]+)`/g, (_, code) => hold(`<code>${esc(code)}</code>`))
    .replace(/<progress\s+value="(\d+(?:\.\d+)?)"\s+max="(\d+(?:\.\d+)?)"\s*>\s*<\/progress>/g, (_, v, m) => hold(`<progress value="${v}" max="${m}"></progress>`))
    .replace(/!?\[\[([^\]]+)\]\]/g, (_, raw) => hold(wikilink(raw, link)))
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, (_, label, url) => hold(`<a class="ext" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`));
  s = esc(s)
    .replace(/\*\*(?=\S)([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)([^_]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?=\S)([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(?=\S)([^~]+?)~~/g, "<del>$1</del>")
    .replace(/==(?=\S)([^=]+?)==/g, "<mark>$1</mark>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[i]);
}

// Lines of one paragraph or list item. Notes are hard-wrapped, so lines are joined -
// except before a "**Label:**" line, after two trailing spaces or a backslash.
// Joined before the inline pass, so **bold** may span a wrapped line.
function joinLines(lines, link) {
  const text = lines
    .map((line, i) => {
      const brk = i > 0 && (/( {2}|\\)$/.test(lines[i - 1]) || /^\*\*/.test(line.trim()));
      return (i === 0 ? "" : brk ? "\u0001" : " ") + line.trim().replace(/\\$/, "");
    })
    .join("");
  return renderInline(text, link).replace(/\u0001/g, "<br>");
}

// ---------- blocks ----------
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const QUOTE = /^\s*>/;

const indentOf = (s) => s.replace(/\t/g, "    ").match(/^ */)[0].length;
const blank = (s) => !s || !s.trim();

// Split a table row at "|", but not at "\|" or inside [[...]] (aliases in tables).
function cells(row) {
  let s = row.trim().replace(/^\|/, "");
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const out = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith("[[", i)) depth++;
    if (s.startsWith("]]", i) && depth) depth--;
    if (s[i] === "|" && s[i - 1] !== "\\" && !depth) {
      out.push(cur);
      cur = "";
    } else cur += s[i];
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/\\\|/g, "|"));
}

function table(lines, link) {
  const align = cells(lines[1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-:$/.test(c) ? "right" : null));
  const td = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ""}>${renderInline(c, link)}</${tag}>`;
  const head = cells(lines[0]).map((c, i) => td("th", c, i)).join("");
  const body = lines
    .slice(2)
    .map((r) => `<tr>${cells(r).map((c, i) => td("td", c, i)).join("")}</tr>`)
    .join("");
  return `<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// A list starting at lines[i] with the given indent; nested lists recurse.
function list(lines, i, indent, link) {
  const ordered = /\d/.test(lines[i].match(ITEM)[2]);
  const items = [];
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(ITEM);
    if (blank(line)) {
      let j = i + 1;
      while (j < lines.length && blank(lines[j])) j++;
      if (j < lines.length && indentOf(lines[j]) > indent && items.length) i = j;
      else if (j < lines.length && ITEM.test(lines[j]) && indentOf(lines[j]) === indent) i = j;
      else break;
      continue;
    }
    if (!m) {
      // Indented text under an item continues it.
      if (indentOf(line) > indent && items.length) {
        items.at(-1).lines.push(line);
        i++;
        continue;
      }
      break;
    }
    const ind = indentOf(m[1]);
    if (ind < indent) break;
    if (ind > indent && items.length) {
      const sub = list(lines, i, ind, link);
      items.at(-1).children += sub.html;
      i = sub.i;
      continue;
    }
    if (/\d/.test(m[2]) !== ordered) break;
    items.push({ lines: [m[3]], children: "", start: parseInt(m[2], 10) });
    i++;
  }
  const lis = items
    .map((it) => {
      const task = it.lines[0].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const done = task[1] !== " ";
        const box = `<span class="check${done ? " done" : ""}" role="img" aria-label="${done ? "done" : "open"}">${done ? "✓" : ""}</span>`;
        return `<li class="task">${box}${joinLines([task[2], ...it.lines.slice(1)], link)}${it.children}</li>`;
      }
      return `<li>${joinLines(it.lines, link)}${it.children}</li>`;
    })
    .join("");
  const start = ordered && items[0]?.start > 1 ? ` start="${items[0].start}"` : "";
  return { html: ordered ? `<ol${start}>${lis}</ol>` : `<ul>${lis}</ul>`, i };
}

const startsBlock = (line, next) =>
  HEADING.test(line) || RULE.test(line) || FENCE.test(line) || QUOTE.test(line) || ITEM.test(line) || (line.includes("|") && TABLE_SEP.test(next || ""));

export function renderMarkdown(md, { link } = {}) {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }
    const fence = line.match(FENCE);
    if (fence) {
      const code = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      i++;
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      const n = h[1].length;
      out.push(`<h${n} id="h-${esc(slug(h[2]))}">${renderInline(h[2], link)}</h${n}>`);
      i++;
      continue;
    }
    if (RULE.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (line.includes("|") && TABLE_SEP.test(lines[i + 1] || "")) {
      const rows = [line, lines[i + 1]];
      for (i += 2; i < lines.length && lines[i].includes("|") && !blank(lines[i]); i++) rows.push(lines[i]);
      out.push(table(rows, link));
      continue;
    }
    if (QUOTE.test(line)) {
      const inner = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) inner.push(lines[i].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${renderMarkdown(inner.join("\n"), { link })}</blockquote>`);
      continue;
    }
    if (ITEM.test(line)) {
      const l = list(lines, i, indentOf(line), link);
      out.push(l.html);
      i = l.i;
      continue;
    }
    const para = [line];
    for (i++; i < lines.length && !blank(lines[i]) && !startsBlock(lines[i], lines[i + 1]); i++) para.push(lines[i]);
    out.push(`<p>${joinLines(para, link)}</p>`);
  }
  return out.join("\n");
}
