// Log forms: field components, one definition per form, validation, and form values -> event.
// Field names are the ones from 01_Dashboard/Schema.md / Event Format.md.

// ---------- definitions ----------
const LOCATIONS = ["Element", "Kletterfabrik", "Boulderdrome", "Home"];
const LIMITERS = ["fingers", "tension", "technique", "pump", "head", "groin"];

const sessionTop = [
  { type: "date", name: "date", label: "Date" },
  { type: "segment", name: "location", label: "Where", options: LOCATIONS, initial: "Element" },
  { type: "duration", name: "duration", label: "Duration" },
];
const sessionBottom = [
  { type: "heading", label: "How it went" },
  { type: "scale", name: "rpe", label: "Effort (RPE)", from: 1, to: 10, required: true },
  { type: "segment", name: "feeling", label: "Feeling", options: ["weak", "normal", "strong"], required: true },
  { type: "scale", name: "finger_pain", label: "Finger pain during training", from: 0, to: 10, pain: 2, required: true },
  { type: "scale", name: "groin_pain", label: "Groin pain during training", from: 0, to: 10, pain: 2, required: true },
  { type: "heading", label: "Notes" },
  { type: "text", name: "went_well", label: "Went well" },
  { type: "chips", name: "limiter", label: "Limiter today", options: LIMITERS },
  { type: "text", name: "next_time", label: "Next time" },
  { type: "textarea", name: "body", label: "Anything else" },
];
const sets = (name, label, hint) => ({ type: "text", name, label, hint, last: true, mono: true });

export const FORMS = {
  volume: {
    id: "volume",
    kind: "session",
    sessionType: "volume",
    title: "Volume",
    day: 0,
    fields: [
      ...sessionTop,
      { type: "heading", label: "Monday" },
      { type: "checklist", name: "done", items: [["warm_up", "Warm-up: wrist, fingers, adductor isometrics"]] },
      sets("pull_up", "Weighted pull-up", "5x3 +15kg  or  3RM +25kg"),
      { type: "stepper", name: "boulder_count", label: "Volume boulders", hint: "tap + after every boulder" },
      { type: "heading", label: "Core block" },
      sets("toes_to_bar", "Toes-to-bar (slow)", "3x8"),
      sets("front_lever", "Front lever tuck", "3x10s"),
      sets("push_ups", "Push-ups", "2x12"),
      ...sessionBottom,
    ],
  },
  power_endurance: {
    id: "power_endurance",
    kind: "session",
    sessionType: "power_endurance",
    title: "Power Endurance",
    day: 3,
    fields: [
      ...sessionTop,
      { type: "heading", label: "Thursday" },
      { type: "checklist", name: "done", items: [["warm_up", "Warm-up: wrist, fingers, adductor isometrics"], ["new_9s", "Looked at the new 9s from Tuesday"]] },
      sets("pull_up", "Weighted pull-up", "4x5 +15kg"),
      { type: "levels", name: "interval_levels", label: "Route intervals - level per round" },
      { type: "heading", label: "Core block" },
      sets("toes_to_bar", "Toes-to-bar (slow)", "3x8"),
      sets("pallof", "Pallof press", "3x10"),
      sets("push_ups", "Push-ups", "2x12"),
      ...sessionBottom,
    ],
  },
  limit: {
    id: "limit",
    kind: "session",
    title: "Limit / Project",
    day: 5,
    fields: [
      ...sessionTop,
      { type: "segment", name: "type", label: "Session", options: ["limit", "project"], labels: ["Limit bouldering", "Projecting"], initial: "limit", required: true },
      { type: "heading", label: "Saturday" },
      { type: "checklist", name: "done", items: [["warm_up", "Warm-up: wrist, fingers, adductor isometrics"], ["silent_feet", "Silent Feet + flat angles"]] },
      { type: "heading", label: "Sends" },
      { type: "stepper", name: "kilter_v7", label: "Kilter V7", initial: 0 },
      { type: "stepper", name: "kilter_v6", label: "Kilter V6", initial: 0 },
      { type: "stepper", name: "element_9", label: "Element level 9", initial: 0 },
      { type: "stepper", name: "element_8", label: "Element level 8", initial: 0 },
      { type: "project", name: "project_name", label: "Project" },
      { type: "heading", label: "Core block (floor)" },
      sets("lying_leg_raises", "Lying leg raises", "3x10"),
      sets("ab_wheel", "Ab-wheel rollout", "3x8"),
      ...sessionBottom,
    ],
  },
  other: {
    id: "other",
    kind: "session",
    title: "Other session",
    fields: [
      ...sessionTop.slice(0, 1),
      { type: "segment", name: "type", label: "Kind", options: ["route", "technique", "rehab"], labels: ["Rope", "Technique", "Rehab"], required: true },
      ...sessionTop.slice(1),
      { type: "text", name: "top_grade", label: "Top grade", hint: "Element level (7/8/9) or Fb (7a+)" },
      ...sessionBottom,
    ],
  },
  home: {
    id: "home",
    kind: "home",
    title: "At home",
    fields: [
      { type: "date", name: "date", label: "Date" },
      { type: "toggle", name: "finger_prehab", label: "Finger prehab", hint: "extensor band + reverse wrist curl" },
      { type: "toggle", name: "adductors", label: "Adductor strength" },
      { type: "text", name: "adductors_detail", label: "Adductors - what and how much", hint: "Band 3x15, Copenhagen 3x20s", last: true, from: "dailies" },
      { type: "toggle", name: "mobility", label: "Stretching / mobility" },
      { type: "number", name: "running", label: "Running", unit: "min", step: 5 },
      { type: "text", name: "other", label: "Anything else", hint: "Shoulder band 2x15" },
    ],
  },
  morning: {
    id: "morning",
    kind: "morning",
    title: "Morning check",
    fields: [
      { type: "date", name: "date", label: "Date" },
      { type: "scale", name: "finger_pain", label: "Finger pain this morning", from: 0, to: 10, pain: 3, hint: "also counts as next-day pain for yesterday's session" },
      { type: "number", name: "sleep", label: "Sleep", unit: "h", step: 0.5 },
    ],
  },
};

export const SESSION_FORMS = ["volume", "power_endurance", "limit", "other"];

// ---------- helpers ----------
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const filled = (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);

function row(spec, control) {
  const wrap = el("div", `field field-${spec.type}`);
  if (spec.label) {
    const label = el("div", "field-label", spec.label);
    if (spec.required) label.append(el("span", "req", " *"));
    wrap.append(label);
  }
  wrap.append(control);
  if (spec.hint && spec.type !== "text") wrap.append(el("div", "field-hint", spec.hint));
  return wrap;
}

// ---------- components ----------
// Each returns an element; ctx = { get, set, last, projects, startedAt }.
const COMPONENTS = {
  heading: (spec) => el("h3", "form-heading", spec.label),

  date(spec, ctx) {
    const input = el("input", "field-input");
    input.type = "date";
    input.value = ctx.get(spec.name);
    input.addEventListener("change", () => input.value && ctx.set(spec.name, input.value));
    return row(spec, input);
  },

  segment(spec, ctx) {
    const group = el("div", "segment");
    group.setAttribute("role", "radiogroup");
    const paint = () => {
      for (const b of group.children) b.setAttribute("aria-checked", String(b.dataset.value === String(ctx.get(spec.name))));
    };
    spec.options.forEach((opt, i) => {
      const b = el("button", "seg", spec.labels ? spec.labels[i] : opt);
      b.type = "button";
      b.dataset.value = opt;
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => {
        ctx.set(spec.name, opt);
        paint();
      });
      group.append(b);
    });
    paint();
    return row(spec, group);
  },

  scale(spec, ctx) {
    const group = el("div", "scale");
    group.setAttribute("role", "radiogroup");
    const status = el("div", "scale-status");
    const paint = () => {
      const v = ctx.get(spec.name);
      for (const b of group.children) {
        b.setAttribute("aria-checked", String(Number(b.dataset.value) === v));
        b.classList.toggle("over", spec.pain !== undefined && Number(b.dataset.value) > spec.pain);
      }
      status.textContent = "";
      if (spec.pain !== undefined && typeof v === "number") {
        const over = v > spec.pain;
        status.className = `scale-status ${over ? "is-over" : "is-ok"}`;
        status.append(el("span", "scale-icon", over ? "!" : "✓"), document.createTextNode(over ? ` above the limit of ${spec.pain}` : ` within the limit of ${spec.pain}`));
      }
    };
    for (let v = spec.from; v <= spec.to; v++) {
      const b = el("button", "scale-btn", String(v));
      b.type = "button";
      b.dataset.value = v;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", `${spec.label}: ${v}`);
      b.addEventListener("click", () => {
        ctx.set(spec.name, v);
        paint();
      });
      group.append(b);
    }
    const box = el("div");
    box.append(group, status);
    paint();
    return row(spec, box);
  },

  stepper(spec, ctx) {
    const box = el("div", "stepper");
    const minus = el("button", "step-btn", "−");
    const plus = el("button", "step-btn", "+");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", `${spec.label} minus one`);
    plus.setAttribute("aria-label", `${spec.label} plus one`);
    const input = el("input", "step-value");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.setAttribute("aria-label", spec.label);
    const paint = () => {
      const v = ctx.get(spec.name);
      input.value = typeof v === "number" ? v : "";
      input.placeholder = "-";
    };
    const change = (delta) => {
      const v = ctx.get(spec.name);
      ctx.set(spec.name, Math.max(0, (typeof v === "number" ? v : 0) + delta));
      paint();
    };
    minus.addEventListener("click", () => change(-1));
    plus.addEventListener("click", () => change(1));
    input.addEventListener("input", () => ctx.set(spec.name, input.value === "" ? null : Math.max(0, Math.round(Number(input.value)))));
    box.append(minus, input, plus);
    paint();
    return row(spec, box);
  },

  number(spec, ctx) {
    const box = el("div", "stepper");
    const input = el("input", "step-value");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = String(spec.step || 1);
    input.min = "0";
    input.setAttribute("aria-label", spec.label);
    const minus = el("button", "step-btn", "−");
    const plus = el("button", "step-btn", "+");
    minus.type = plus.type = "button";
    const paint = () => {
      const v = ctx.get(spec.name);
      input.value = typeof v === "number" ? v : "";
    };
    const change = (delta) => {
      const v = ctx.get(spec.name);
      ctx.set(spec.name, Math.max(0, Math.round(((typeof v === "number" ? v : 0) + delta) * 10) / 10));
      paint();
    };
    minus.addEventListener("click", () => change(-(spec.step || 1)));
    plus.addEventListener("click", () => change(spec.step || 1));
    input.addEventListener("input", () => ctx.set(spec.name, input.value === "" ? null : Number(input.value)));
    const unit = el("span", "step-unit", spec.unit || "");
    box.append(minus, input, plus, unit);
    paint();
    return row(spec, box);
  },

  text(spec, ctx) {
    const box = el("div", "text-box");
    const input = el("input", `field-input${spec.mono ? " mono" : ""}`);
    input.type = "text";
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.placeholder = spec.hint || "";
    input.value = ctx.get(spec.name) || "";
    input.setAttribute("aria-label", spec.label);
    input.addEventListener("input", () => ctx.set(spec.name, input.value));
    box.append(input);
    const last = spec.last ? ctx.last(spec.name, spec.from) : null;
    if (last) {
      const chip = el("button", "chip chip-last");
      chip.type = "button";
      chip.textContent = `Last: ${last}`;
      chip.addEventListener("click", () => {
        input.value = last;
        ctx.set(spec.name, last);
      });
      box.append(chip);
    }
    return row(spec, box);
  },

  textarea(spec, ctx) {
    const input = el("textarea", "field-input");
    input.rows = 3;
    input.value = ctx.get(spec.name) || "";
    input.setAttribute("aria-label", spec.label);
    input.addEventListener("input", () => ctx.set(spec.name, input.value));
    return row(spec, input);
  },

  toggle(spec, ctx) {
    const b = el("button", "toggle");
    b.type = "button";
    b.setAttribute("role", "switch");
    const paint = () => {
      const on = ctx.get(spec.name) === true;
      b.setAttribute("aria-checked", String(on));
      b.textContent = "";
      b.append(el("span", "toggle-box", on ? "✓" : ""), el("span", "toggle-text", spec.label));
      if (spec.hint) b.append(el("span", "toggle-hint", spec.hint));
    };
    b.addEventListener("click", () => {
      ctx.set(spec.name, ctx.get(spec.name) !== true);
      paint();
    });
    paint();
    const wrap = el("div", "field");
    wrap.append(b);
    return wrap;
  },

  checklist(spec, ctx) {
    const wrap = el("div", "field");
    for (const [key, label] of spec.items) {
      const b = el("button", "toggle");
      b.type = "button";
      b.setAttribute("role", "checkbox");
      const paint = () => {
        const on = (ctx.get(spec.name) || []).includes(key);
        b.setAttribute("aria-checked", String(on));
        b.textContent = "";
        b.append(el("span", "toggle-box", on ? "✓" : ""), el("span", "toggle-text", label));
      };
      b.addEventListener("click", () => {
        const list = new Set(ctx.get(spec.name) || []);
        list.has(key) ? list.delete(key) : list.add(key);
        ctx.set(spec.name, [...list]);
        paint();
      });
      paint();
      wrap.append(b);
    }
    return wrap;
  },

  chips(spec, ctx) {
    const group = el("div", "chip-row");
    const selected = () => String(ctx.get(spec.name) || "").split(", ").filter(Boolean);
    const paint = () => {
      for (const b of group.children) b.setAttribute("aria-pressed", String(selected().includes(b.dataset.value)));
    };
    for (const opt of spec.options) {
      const b = el("button", "chip", opt);
      b.type = "button";
      b.dataset.value = opt;
      b.addEventListener("click", () => {
        const s = new Set(selected());
        s.has(opt) ? s.delete(opt) : s.add(opt);
        ctx.set(spec.name, spec.options.filter((o) => s.has(o)).join(", "));
        paint();
      });
      group.append(b);
    }
    paint();
    return row(spec, group);
  },

  levels(spec, ctx) {
    const box = el("div", "levels");
    const rounds = el("div", "levels-rounds");
    const buttons = el("div", "levels-add");
    const list = () => String(ctx.get(spec.name) || "").split("-").filter(Boolean);
    const paint = () => {
      rounds.textContent = "";
      const l = list();
      if (!l.length) rounds.append(el("span", "muted", "No rounds yet - tap the level of each round."));
      l.forEach((lv, i) => rounds.append(el("span", "round", `${i + 1}: ${lv}`)));
      if (l.length) {
        const undo = el("button", "chip", "Undo last");
        undo.type = "button";
        undo.addEventListener("click", () => {
          ctx.set(spec.name, list().slice(0, -1).join("-"));
          paint();
        });
        rounds.append(undo);
      }
    };
    for (let lv = 4; lv <= 9; lv++) {
      const b = el("button", "seg", String(lv));
      b.type = "button";
      b.setAttribute("aria-label", `Add a round at level ${lv}`);
      b.addEventListener("click", () => {
        ctx.set(spec.name, [...list(), String(lv)].join("-"));
        paint();
      });
      buttons.append(b);
    }
    box.append(buttons, rounds);
    paint();
    return row(spec, box);
  },

  duration(spec, ctx) {
    const box = el("div", "stepper");
    const input = el("input", "step-value");
    input.type = "number";
    input.inputMode = "numeric";
    input.setAttribute("aria-label", "Duration in minutes");
    input.value = ctx.get(spec.name) ?? "";
    input.addEventListener("input", () => ctx.set(spec.name, input.value === "" ? null : Math.round(Number(input.value))));
    const chip = el("button", "chip chip-last");
    chip.type = "button";
    const minutes = () => Math.max(1, Math.round((Date.now() - new Date(ctx.startedAt).getTime()) / 60000));
    const paint = () => (chip.textContent = `Timer: ${minutes()} min`);
    chip.addEventListener("click", () => {
      input.value = minutes();
      ctx.set(spec.name, minutes());
    });
    paint();
    const timer = setInterval(() => (document.body.contains(chip) ? paint() : clearInterval(timer)), 30000);
    box.append(input, el("span", "step-unit", "min"), chip);
    const wrap = row({ ...spec, required: true }, box);
    wrap.append(el("div", "field-hint", `Timer started ${new Date(ctx.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} when this form was opened.`));
    return wrap;
  },

  project(spec, ctx) {
    const box = el("div", "project-box");
    const select = el("select", "field-input");
    select.setAttribute("aria-label", "Project");
    const options = [["", "No project today"], ...ctx.projects.map((p) => [p, p]), ["__new", "New project..."]];
    for (const [value, label] of options) {
      const o = el("option", "", label);
      o.value = value;
      select.append(o);
    }
    const name = ctx.get("project_name") || "";
    select.value = !name ? "" : ctx.projects.includes(name) ? name : "__new";
    const details = el("div", "project-details");
    const paint = () => {
      details.textContent = "";
      details.hidden = !select.value;
      if (!select.value) return;
      if (select.value === "__new") {
        details.append(
          COMPONENTS.text({ type: "text", name: "project_name", label: "Name", hint: "as on the board / wall" }, ctx),
          COMPONENTS.segment({ type: "segment", name: "project_wall", label: "Wall", options: ["Kilter", "Element"] }, ctx),
          COMPONENTS.text({ type: "text", name: "project_grade", label: "Grade", hint: "7b" }, ctx)
        );
      }
      details.append(
        COMPONENTS.stepper({ type: "stepper", name: "project_attempts", label: "Attempts today" }, ctx),
        COMPONENTS.text({ type: "text", name: "project_highpoint", label: "Highpoint / status", hint: "crux solved, fell at the last move" }, ctx),
        COMPONENTS.toggle({ type: "toggle", name: "project_sent", label: "Sent!" }, ctx)
      );
    };
    select.addEventListener("change", () => {
      if (select.value === "__new") ctx.set("project_name", "");
      else ctx.set("project_name", select.value || null);
      paint();
    });
    box.append(select, details);
    paint();
    return row(spec, box);
  },
};

export function renderFields(form, ctx) {
  const frag = document.createDocumentFragment();
  for (const spec of form.fields) frag.append(COMPONENTS[spec.type](spec, ctx));
  return frag;
}

// ---------- values -> event ----------
export function initialValues(form, date) {
  const v = { date };
  for (const f of form.fields) if (f.initial !== undefined) v[f.name] = f.initial;
  return v;
}

export function missing(form, values) {
  const out = [];
  for (const f of form.fields) if (f.required && !filled(values[f.name])) out.push(f.label);
  if (form.kind === "session" && !filled(values.duration)) out.push("Duration");
  if (form.kind === "home" && !["finger_prehab", "adductors", "mobility", "running", "other", "adductors_detail"].some((k) => filled(values[k]) && values[k] !== false))
    out.push("at least one entry");
  if (form.kind === "morning" && !filled(values.finger_pain) && !filled(values.sleep)) out.push("finger pain or sleep");
  const bad = form.kind === "session" && values.project_name !== undefined && /[\\/:#^[\]|]/.test(values.project_name || "");
  if (bad) out.push("a project name without / : # [ ] |");
  return [...new Set(out)];
}

// Returns { kind, date, fields, body } for lib/events.js.
export function toEventFields(form, values) {
  const { date, body, ...rest } = values;
  const fields = {};
  const known = new Set(form.fields.map((f) => f.name).filter(Boolean));
  for (const k of ["duration", "project_name", "project_attempts", "project_highpoint", "project_sent", "project_wall", "project_grade", "type"]) known.add(k);
  for (const [k, v] of Object.entries(rest)) if (known.has(k) && filled(v) && v !== false) fields[k] = v;
  if (form.kind === "session") {
    fields.type = form.sessionType || values.type;
    if (fields.interval_levels) fields.interval_rounds = fields.interval_levels.split("-").length;
    if (fields.project_name) {
      const status = fields.project_sent ? "sent" : fields.project_highpoint || (fields.project_attempts ? `${fields.project_attempts} attempts` : "");
      fields.project = status ? `${fields.project_name} - ${status}` : fields.project_name;
    } else {
      for (const k of Object.keys(fields)) if (k.startsWith("project_")) delete fields[k];
    }
    if (fields.project_wall === "Kilter" && !fields.project_grade) delete fields.project_grade;
  }
  return { kind: form.kind, date, fields, body: body || "" };
}
