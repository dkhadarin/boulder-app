// Progress model - shared by the app (Progress screen) and the Mac (01_Dashboard/Progress.md).
// Pure functions only: no file access, no DOM. Input:
//   data   - frontmatter of the vault notes (built by processor/vault.js)
//   manual - hand-written parts of Progress.md (built by processor/progress-page.js)
//   today  - "YYYY-MM-DD"
// Warnings come out as codes, so the app decides how to word them.

// ---------- dates ----------
const DAY_MS = 86400000;
const utc = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);
export const addDays = (iso, n) => new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);
// 0 = Monday ... 6 = Sunday
export const weekday = (iso) => (new Date(utc(iso)).getUTCDay() + 6) % 7;
export const weekStart = (iso) => addDays(iso, -weekday(iso));

const BOULDER_DAYS = [0, 3, 5]; // Mon, Thu, Sat
const HOME_DAYS = [1, 4]; // Tue, Fri
const BOULDER_TYPES = ["volume", "power_endurance", "limit", "project", "technique"];
const isNumber = (v) => typeof v === "number" && !Number.isNaN(v);
const isEmpty = (v) => v === null || v === undefined || v === "";
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

// ---------- entry point ----------
export function computeProgress(data, manual, today) {
  const sessions = [...(data.sessions || [])].filter((s) => s.date).sort(byDate);
  const dailies = [...(data.dailies || [])].filter((d) => d.date).sort(byDate);
  const assessments = [...(data.assessments || [])].filter((a) => a.date).sort(byDate);
  const ctx = { data, sessions, dailies, assessments, today };

  const allDates = [...sessions, ...dailies, ...assessments].map((x) => x.date);
  const updated = allDates.length ? allDates.sort().at(-1) : today;

  return {
    updated,
    today,
    goals: {
      kilter: kilterGoal(ctx, manual.goals?.kilter),
      element: elementGoal(ctx, manual.goals?.element),
      oap: oapGoal(ctx, manual.goals?.oap),
    },
    block: currentBlock(ctx),
    strength: strength(ctx, manual.strength || []),
    body: body(ctx, manual.body || []),
    pain: painSeries(ctx),
    pullUp: pullUpSeries(ctx),
    milestones: manual.milestones || [],
    warnings: warnings(ctx),
  };
}

// ---------- goals ----------
// Ladder steps come from the hand-written checkbox list. An open step gets ticked
// automatically once the data proves it; ticked steps are never unticked.
function ladder(items, keyPattern, evidence) {
  return (items || []).map((item) => {
    const m = item.text.match(keyPattern);
    const key = m ? m[0].replace(/\*/g, "") : item.text;
    const number = m ? Number(m[1]) : null;
    if (item.done || number === null) return { ...item, key, number, isNew: false };
    const e = evidence(number);
    if (!e) return { ...item, key, number, isNew: false };
    return { done: true, text: e.text ? `${item.text} - ${e.text}` : item.text, key, number, isNew: true, date: e.date };
  });
}

function goalFrame(steps, manual) {
  const reached = steps.filter((s) => s.done).length;
  const last = [...steps].reverse().find((s) => s.done);
  return {
    title: (manual?.title || "").replace(/^\d+\.\s*/, ""),
    steps,
    reached,
    max: steps.length,
    current: last ? last.key : null,
    target: steps.length ? steps.at(-1).key : null,
    statusText: manual?.statusText || "",
    nextStep: manual?.nextStep || "",
  };
}

const kilterV = (grade) => {
  const m = String(grade || "").match(/V(\d+)/);
  return m ? Number(m[1]) : null;
};

function kilterGoal(ctx, manual) {
  const kilter = ctx.data.kilter || { sends: [], cutoff: null };
  const cutoff = kilter.cutoff || "0000-00-00";
  const sends = (kilter.sends || []).map((s) => ({ ...s, v: kilterV(s.grade) })).sort(byDate);
  // Sessions after the Boardsesh fetch are not in the ticklist yet.
  const newer = ctx.sessions.filter((s) => s.date > cutoff);
  const total = (v) =>
    sends.filter((s) => s.v === v).length +
    newer.reduce((acc, s) => acc + (isNumber(s[`kilter_v${v}`]) ? s[`kilter_v${v}`] : 0), 0);

  const evidence = (v) => {
    const send = sends.find((s) => s.v >= v);
    if (send) return { date: send.date, text: `${send.boulder} (${send.date})` };
    const session = newer.find((s) => [v, v + 1, v + 2].some((g) => isNumber(s[`kilter_v${g}`]) && s[`kilter_v${g}`] > 0));
    return session ? { date: session.date, text: `(${session.date})` } : null;
  };

  const distribution = {};
  for (const s of sends) if (s.v !== null) distribution[s.v] = (distribution[s.v] || 0) + 1;
  for (const s of newer) {
    for (const [k, n] of Object.entries(s)) {
      const m = k.match(/^kilter_v(\d+)$/);
      if (m && isNumber(n)) distribution[m[1]] = (distribution[m[1]] || 0) + n;
    }
  }

  return {
    ...goalFrame(ladder(manual?.ladder, /V(\d+)/, evidence), manual),
    counts: { v8: total(8), v7: total(7), v6: total(6) },
    distribution,
    cutoff: kilter.cutoff,
  };
}

function elementGoal(ctx, manual) {
  const blocks = [...(ctx.data.blocks || [])].filter((b) => b.start).sort((a, b) => (a.start < b.start ? -1 : 1));
  const since = blocks.length ? blocks[0].start : "0000-00-00";
  const inRange = ctx.sessions.filter((s) => s.date >= since);
  const total = (field) => inRange.reduce((acc, s) => acc + (isNumber(s[field]) ? s[field] : 0), 0);
  const evidence = (level) => {
    const s = ctx.sessions.find((x) => isNumber(x[`element_${level}`]) && x[`element_${level}`] > 0);
    return s ? { date: s.date, text: s.date } : null;
  };
  return {
    ...goalFrame(ladder(manual?.ladder, /Level (\d+)/, evidence), manual),
    counts: { l9: total("element_9"), l8: total("element_8") },
    since,
  };
}

function oapGoal(ctx, manual) {
  const stage = ctx.data.oap?.stage;
  const evidence = (n) => (isNumber(stage) && stage >= n ? { text: "" } : null);
  return { ...goalFrame(ladder(manual?.ladder, /Stage (\d+)/, evidence), manual), stage: isNumber(stage) ? stage : null };
}

// ---------- current block ----------
function currentBlock(ctx) {
  const blocks = [...(ctx.data.blocks || [])].filter((b) => b.start && b.end).sort((a, b) => (a.start < b.start ? -1 : 1));
  if (!blocks.length) return null;
  const today = ctx.today;
  const block =
    blocks.find((b) => b.start <= today && today <= b.end) ||
    blocks.find((b) => b.start > today) ||
    blocks.at(-1);

  const weeks = Math.round((daysBetween(block.start, block.end) + 1) / 7);
  let week = 0;
  let phase = "running";
  if (today < block.start) phase = "upcoming";
  else if (today > block.end) {
    phase = "done";
    week = weeks;
  } else week = Math.floor(daysBetween(block.start, today) / 7) + 1;

  const inside = (x) => x.date >= block.start && x.date <= block.end;
  const sessions = ctx.sessions.filter(inside);
  const dailies = ctx.dailies.filter(inside);
  const boulder = sessions.filter((s) => BOULDER_TYPES.includes(s.type));
  const home = dailies.filter((d) => d.adductors === true || d.finger_prehab === true);
  const tests = ctx.assessments.filter(inside);

  const calendar = [];
  for (let d = block.start; d <= block.end; d = addDays(d, 1)) {
    const wd = weekday(d);
    calendar.push({
      date: d,
      weekday: wd,
      week: Math.floor(daysBetween(block.start, d) / 7) + 1,
      planned: BOULDER_DAYS.includes(wd) ? "boulder" : HOME_DAYS.includes(wd) ? "home" : null,
      sessions: sessions.filter((s) => s.date === d).map((s) => ({ type: s.type, file: s.file })),
      home: home.some((x) => x.date === d),
      test: tests.some((x) => x.date === d),
    });
  }

  return {
    name: block.file,
    start: block.start,
    end: block.end,
    focus: block.focus || "",
    weeks,
    week,
    phase,
    daysUntilStart: phase === "upcoming" ? daysBetween(today, block.start) : 0,
    deload: week === weeks,
    sessions: { target: BOULDER_DAYS.length * weeks, actual: sessions.length },
    targets: [
      { id: "boulder", target: BOULDER_DAYS.length * weeks, actual: boulder.length },
      { id: "home", target: HOME_DAYS.length * weeks, actual: home.length },
      { id: "testday", target: 1, actual: tests.length },
    ],
    calendar,
  };
}

// ---------- strength ----------
const kgText = (v) => {
  const m = String(v).match(/([+-]?\s*\d+(?:[.,]\d+)?)\s*kg/i);
  if (!m) return null;
  const n = m[1].replace(/\s/g, "").replace(",", ".");
  return `${/^[+-]/.test(n) ? n : "+" + n} kg`;
};
const kgNumber = (v) => {
  const m = String(v).match(/([+-]?\s*\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : null;
};

// Which row of the "Strength" table is fed by which field.
const STRENGTH_ROWS = [
  { pattern: /^Weighted Pull-Up/i, source: "sessions", field: "pull_up", only: /3RM/i, format: kgText },
  { pattern: /^20 ?mm Hang Half Crimp/i, source: "assessments", field: "hang_20mm_half_crimp" },
  { pattern: /^20 ?mm Hang Open/i, source: "assessments", field: "hang_20mm_open" },
  { pattern: /^Toes-to-Bar/i, source: "sessions", field: "toes_to_bar" },
  { pattern: /^Lying Leg Raises/i, source: "sessions", field: "lying_leg_raises" },
  { pattern: /^Front Lever/i, source: "sessions", field: "front_lever" },
  { pattern: /^Ab-Wheel/i, source: "sessions", field: "ab_wheel" },
  { pattern: /^Pallof/i, source: "sessions", field: "pallof" },
  { pattern: /^Push-Ups/i, source: "sessions", field: "push_ups" },
  {
    pattern: /^Adductors: Copenhagen/i,
    source: "dailies",
    field: "adductors_detail",
    format: (v) => {
      const m = String(v).match(/Copenhagen[^,]*?(\d+\s*x\s*\d+\s*s)/i);
      return m ? m[1] : null;
    },
  },
];

function strength(ctx, rows) {
  return rows.map((row) => {
    const rule = STRENGTH_ROWS.find((r) => r.pattern.test(row.name));
    if (!rule) return withHistory(row, []);
    const entries = ctx[rule.source]
      .filter((x) => !isEmpty(x[rule.field]) && (!rule.only || rule.only.test(String(x[rule.field]))))
      .map((x) => ({ date: x.date, value: rule.format ? rule.format(x[rule.field]) : String(x[rule.field]) }))
      .filter((e) => e.value !== null);
    return withHistory(row, entries, (e) => e.value);
  });
}

// ---------- body ----------
function body(ctx, rows) {
  const a2 = (ctx.data.injuries || []).find((v) => /A2/.test(v.file || ""));
  const finger = painSeries(ctx)
    .map((t) => ({ date: t.date, value: maxValue([t.finger_session, t.finger_morning, t.finger_next_day_prev]) }))
    .filter((e) => e.value !== null);
  const groin = ctx.dailies
    .filter((d) => isNumber(d.groin_stretch_pain))
    .map((d) => ({ date: d.date, value: d.groin_stretch_pain }));
  const weight = ctx.assessments.filter((a) => isNumber(a.weight)).map((a) => ({ date: a.date, value: a.weight }));

  return rows.map((row) => {
    if (/^Finger/i.test(row.name))
      return withHistory(row, finger.map(asText), (e) => `${a2?.status || "?"}, ${e.value}/10`);
    if (/^Groin/i.test(row.name))
      return withHistory(row, groin.map(asText), (e) => (Number(e.value) >= 3 ? `**${e.value}/10**` : `${e.value}/10`));
    if (/^Weight/i.test(row.name)) return withHistory(row, weight.map(asText), (e) => `${e.value} kg`);
    return withHistory(row, []);
  });
}

const asText = (e) => ({ date: e.date, value: String(e.value) });
const maxValue = (values) => {
  const nums = values.filter(isNumber);
  return nums.length ? Math.max(...nums) : null;
};

// Merges data entries into a hand-written table row "Name | Current | Target | History".
// Unchanged rows keep their exact text, so the page does not churn.
function withHistory(row, entries, currentFrom) {
  const old = parseHistory(row.history);
  const fresh = entries.filter((e) => !old.some((o) => o.date === e.date && norm(o.value) === norm(e.value)));
  const merged = new Map(old.map((o) => [o.date, o.value]));
  for (const e of entries) if (!merged.has(e.date) || fresh.includes(e)) merged.set(e.date, e.value);
  const list = [...merged.entries()].map(([date, value]) => ({ date, value })).sort(byDate);
  if (!fresh.length) return { ...row, entries: list, changed: false };

  const newest = [...entries].sort(byDate).at(-1);
  const newestOld = old.length ? [...old].sort(byDate).at(-1).date : "";
  return {
    ...row,
    current: currentFrom && newest.date >= newestOld ? currentFrom(newest) : row.current,
    history: [...list].reverse().map((e) => `${e.date}: ${e.value}`).join("; "),
    entries: list,
    changed: true,
  };
}

export function parseHistory(text) {
  return [...String(text || "").matchAll(/(\d{4}-\d{2}-\d{2}):\s*([^;]+)/g)].map((m) => ({
    date: m[1],
    value: m[2].trim(),
  }));
}

// ---------- series for charts ----------
function painSeries(ctx) {
  const days = new Map();
  const day = (d) => {
    if (!days.has(d)) days.set(d, { date: d });
    return days.get(d);
  };
  for (const s of ctx.sessions) {
    if (isNumber(s.finger_pain)) day(s.date).finger_session = s.finger_pain;
    if (isNumber(s.groin_pain)) day(s.date).groin_session = s.groin_pain;
    if (isNumber(s.finger_pain_next_day)) {
      day(s.date).finger_next_day = s.finger_pain_next_day;
      day(addDays(s.date, 1)).finger_next_day_prev = s.finger_pain_next_day;
    }
    if (isNumber(s.rpe) && isNumber(s.duration)) day(s.date).load = s.rpe * s.duration;
  }
  for (const d of ctx.dailies) {
    if (isNumber(d.finger_pain)) day(d.date).finger_morning = d.finger_pain;
    if (isNumber(d.groin_stretch_pain)) day(d.date).groin_stretch = d.groin_stretch_pain;
  }
  return [...days.values()].sort(byDate);
}

function pullUpSeries(ctx) {
  return ctx.sessions
    .filter((s) => !isEmpty(s.pull_up))
    .map((s) => ({ date: s.date, text: String(s.pull_up), kg: kgNumber(s.pull_up), test: /3RM/i.test(String(s.pull_up)) }))
    .filter((e) => e.kg !== null);
}

// ---------- warnings ----------
function warnings(ctx) {
  const list = [];
  const last = ctx.sessions.at(-1);
  if (last) {
    for (const [field, area] of [["finger_pain", "finger"], ["groin_pain", "groin"]]) {
      if (isNumber(last[field]) && last[field] >= 3) list.push({ code: "pain_high", area, value: last[field], date: last.date });
    }
    if (isEmpty(last.finger_pain_next_day) && last.date < ctx.today && daysBetween(last.date, ctx.today) <= 2)
      list.push({ code: "next_day_missing", date: last.date, file: last.file });
  }
  const withNextDay = ctx.sessions.filter((s) => isNumber(s.finger_pain_next_day));
  const [prev, latest] = withNextDay.slice(-2);
  if (prev && latest && prev.finger_pain_next_day >= 3 && latest.finger_pain_next_day >= 3)
    list.push({ code: "a2_early_warning", date: latest.date, values: [prev.finger_pain_next_day, latest.finger_pain_next_day] });

  const week = weekStart(ctx.today);
  const boulderDays = new Set(
    ctx.sessions.filter((s) => BOULDER_TYPES.includes(s.type) && weekStart(s.date) === week).map((s) => s.date)
  ).size;
  if (boulderDays >= 4) list.push({ code: "fourth_bouldering_day", count: boulderDays, week });
  else if (boulderDays === 3) list.push({ code: "weekly_limit_reached", week });
  return list;
}
