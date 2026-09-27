// Hand-rolled SVG/HTML charts for the Progress screen (no libraries, works offline).
// Specs: 2px lines, 8px markers with a 2px surface ring, hairline solid grid,
// bars <= 24px with a 4px rounded data-end, legend for >= 2 series, sparse direct
// labels, crosshair tooltip, and a table view for every chart.

import { longDate, shortDate } from "./format.js";

const NS = "http://www.w3.org/2000/svg";
const DAY = 86400000;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);

function svg(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function html(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceScale(max) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) || 10 * mag;
  return { max: Math.ceil(max / step) * step, step };
}

// ---------- tooltip ----------
function tooltip(host) {
  const tip = html("div", "chart-tip");
  tip.hidden = true;
  host.append(tip);
  return {
    show(x, y, header, rows) {
      tip.textContent = "";
      tip.append(html("div", "chart-tip-head", header));
      for (const r of rows) {
        const row = html("div", "chart-tip-row");
        if (r.color) {
          const key = html("span", r.bar ? "key-bar" : "key-line");
          key.style.background = `var(${r.color})`;
          row.append(key);
        }
        row.append(html("strong", "", r.value), html("span", "chart-tip-name", r.name));
        tip.append(row);
      }
      tip.hidden = false;
      const w = tip.offsetWidth;
      const left = Math.min(Math.max(x - w / 2, 0), host.clientWidth - w);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(y - tip.offsetHeight - 12, 0)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

// ---------- legend + table ----------
function legend(series, kind) {
  const box = html("div", "chart-legend");
  for (const s of series) {
    const item = html("span", "legend-item");
    const key = html("span", kind === "bar" ? "key-bar" : "key-line");
    key.style.background = `var(${s.color})`;
    item.append(key, document.createTextNode(s.name));
    box.append(item);
  }
  return box;
}

function tableView(headers, rows) {
  const details = html("details", "chart-table");
  details.append(html("summary", "", "Show as table"));
  const table = html("table");
  const head = table.createTHead().insertRow();
  for (const h of headers) head.append(html("th", "", h));
  const body = table.createTBody();
  for (const r of rows) {
    const tr = body.insertRow();
    for (const c of r) tr.append(html("td", "", c));
  }
  details.append(table);
  return details;
}

// ---------- line chart ----------
// series: [{ name, color: "--series-1", points: [{ date, value, text? }] }]
export function lineChart(host, { series, format = String, thresholds = [], minMax = 5, height = 180, start, end, emptyText, label }) {
  host.textContent = "";
  host.classList.add("chart");
  const active = series.filter((s) => s.points.length);
  if (!active.length) {
    host.append(html("p", "chart-empty", emptyText));
    return;
  }
  if (active.length >= 2) host.append(legend(active, "line"));
  const plot = html("div", "chart-plot");
  host.append(plot);

  const dates = [...new Set(active.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const valueAt = (s, d) => s.points.find((p) => p.date === d);

  let lastWidth = 0;
  const draw = () => {
    const W = Math.round(plot.clientWidth || 320);
    if (W === lastWidth) return;
    lastWidth = W;
    plot.textContent = "";
    const H = height;
    const m = { l: 34, r: 44, t: 12, b: 26 };

    let x0 = ms(start || dates[0]);
    let x1 = ms(end || dates.at(-1));
    if (x1 - x0 < 6 * DAY) {
      const mid = (x0 + x1) / 2;
      x0 = mid - 3 * DAY;
      x1 = mid + 3 * DAY;
    }
    const top = Math.max(minMax, ...active.flatMap((s) => s.points.map((p) => p.value)), ...thresholds.map((t) => t.value));
    const { max: yMax, step } = niceScale(top);
    const X = (d) => m.l + ((ms(d) - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = (v) => m.t + (1 - v / yMax) * (H - m.t - m.b);

    const root = svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label });
    plot.append(root);

    for (let v = 0; v <= yMax + 1e-9; v += step) {
      svg("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: v === 0 ? "axis" : "grid" }, root);
      svg("text", { x: m.l - 6, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, root).textContent = format(+v.toFixed(2));
    }
    const ticks = W < 360 ? 3 : 4;
    for (let i = 0; i < ticks; i++) {
      const t = x0 + (i * (x1 - x0)) / (ticks - 1);
      const anchor = i === 0 ? "start" : i === ticks - 1 ? "end" : "middle";
      svg("text", { x: X(isoOf(t)), y: H - 6, class: "tick", "text-anchor": anchor }, root).textContent = shortDate(isoOf(t));
    }
    for (const th of thresholds) {
      svg("line", { x1: m.l, x2: W - m.r, y1: Y(th.value), y2: Y(th.value), class: "threshold" }, root);
      svg("text", { x: m.l + 4, y: Y(th.value) - 4, class: "threshold-label" }, root).textContent = th.label;
    }

    const cross = svg("line", { y1: m.t, y2: H - m.b, class: "crosshair", visibility: "hidden" }, root);
    for (const s of active) {
      const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
      if (pts.length > 1) {
        svg("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${X(p.date)},${Y(p.value)}`).join(""), class: "series-line", style: `stroke: var(${s.color})` }, root);
      }
      for (const p of pts) svg("circle", { cx: X(p.date), cy: Y(p.value), r: 4, class: "series-dot", style: `fill: var(${s.color})` }, root);
    }

    // Direct end labels, only when they don't collide (legend + tooltip carry the rest).
    const ends = active.map((s) => {
      const last = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
      return { x: X(last.date), y: Y(last.value), text: format(last.value) };
    });
    const collide = ends.some((a, i) => ends.some((b, j) => i !== j && Math.abs(a.y - b.y) < 14));
    if (!collide && ends.length <= 4) {
      for (const e of ends) svg("text", { x: e.x + 8, y: e.y + 4, class: "end-label" }, root).textContent = e.text;
    }

    const tip = tooltip(plot);
    const overlay = svg("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: "hit", tabindex: 0, "aria-label": `${label}: use the arrow keys` }, root);
    let index = dates.length - 1;
    const showAt = (i) => {
      index = Math.max(0, Math.min(dates.length - 1, i));
      const d = dates[index];
      cross.setAttribute("x1", X(d));
      cross.setAttribute("x2", X(d));
      cross.setAttribute("visibility", "visible");
      const rows = active
        .map((s) => ({ s, p: valueAt(s, d) }))
        .filter((r) => r.p)
        .map((r) => ({ color: r.s.color, value: r.p.text || format(r.p.value), name: r.s.name }));
      tip.show(X(d), m.t + 8, longDate(d), rows);
    };
    const hide = () => {
      cross.setAttribute("visibility", "hidden");
      tip.hide();
    };
    overlay.addEventListener("pointermove", (ev) => {
      const box = root.getBoundingClientRect();
      const px = ev.clientX - box.left;
      let best = 0;
      dates.forEach((d, i) => {
        if (Math.abs(X(d) - px) < Math.abs(X(dates[best]) - px)) best = i;
      });
      showAt(best);
    });
    overlay.addEventListener("pointerleave", hide);
    overlay.addEventListener("focus", () => showAt(index));
    overlay.addEventListener("blur", hide);
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") showAt(index - 1);
      else if (ev.key === "ArrowRight") showAt(index + 1);
      else return;
      ev.preventDefault();
    });
  };

  draw();
  if (window.ResizeObserver) new ResizeObserver(draw).observe(plot);
  host.append(
    tableView(
      ["Date", ...active.map((s) => s.name)],
      dates.map((d) => [d, ...active.map((s) => (valueAt(s, d) ? valueAt(s, d).text || format(valueAt(s, d).value) : "-"))])
    )
  );
}

// ---------- horizontal bar chart ----------
// bars: [{ label, value }] - one series, one color.
export function barChart(host, { bars, color = "--series-1", name, format = String, emptyText }) {
  host.textContent = "";
  host.classList.add("chart");
  if (!bars.some((b) => b.value > 0)) {
    host.append(html("p", "chart-empty", emptyText));
    return;
  }
  const max = Math.max(...bars.map((b) => b.value));
  const list = html("div", "bar-list");
  host.append(list);
  const tip = tooltip(host);
  for (const b of bars) {
    const row = html("div", "bar-row");
    row.tabIndex = 0;
    const track = html("div", "bar-track");
    const bar = html("div", "bar");
    bar.style.width = `${(b.value / max) * 100}%`;
    bar.style.background = `var(${color})`;
    if (!b.value) bar.hidden = true;
    track.append(bar, html("span", "bar-value", format(b.value)));
    row.append(html("span", "bar-label", b.label), track);
    const show = () => {
      const hostBox = host.getBoundingClientRect();
      const box = bar.getBoundingClientRect();
      tip.show(box.right - hostBox.left, box.top - hostBox.top, b.label, [{ color, bar: true, value: format(b.value), name }]);
    };
    row.addEventListener("pointerenter", show);
    row.addEventListener("pointerleave", () => tip.hide());
    row.addEventListener("focus", show);
    row.addEventListener("blur", () => tip.hide());
    list.append(row);
  }
  host.append(tableView(["Grade", name], bars.map((b) => [b.label, format(b.value)])));
}
