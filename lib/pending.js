// Local events the Mac has not processed yet, laid over the last imported data -
// so Progress is up to date right after a log in the gym. Mirrors processor/events.js.

const BODY_ONLY = ["went_well", "limiter", "next_time", "done", "body"];
const filled = (v) => v !== null && v !== undefined && v !== "";
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function pendingEvents(data, events) {
  const done = new Set((data?.events || []).map(String));
  return events.filter((e) => !done.has(String(e.id)));
}

export function withPending(data, events) {
  const pending = pendingEvents(data, events).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!pending.length) return data;
  // Like the processor: the first real session removes the example note.
  const hasSession = pending.some((e) => e.event === "session");
  const sessions = (data.sessions || []).filter((s) => !(hasSession && s.example)).map((s) => ({ ...s }));
  const dailies = (data.dailies || []).map((d) => ({ ...d }));
  const dailyOf = (date) => {
    let d = dailies.find((x) => x.date === date);
    if (!d) dailies.push((d = { type: "daily", date, file: date, pending: true }));
    return d;
  };

  for (const ev of pending) {
    if (ev.event === "session") {
      const s = { file: `${ev.date} (not synced yet)`, pending: true };
      for (const [k, v] of Object.entries(ev)) {
        if (["event", "id", "created"].includes(k) || BODY_ONLY.includes(k) || k.startsWith("project_")) continue;
        s[k] = v;
      }
      sessions.push(s);
    } else if (ev.event === "home") {
      const d = dailyOf(ev.date);
      for (const k of ["finger_prehab", "adductors", "mobility"]) if (ev[k] === true) d[k] = true;
      for (const k of ["adductors_detail", "other"]) {
        if (filled(ev[k])) d[k] = filled(d[k]) && d[k] !== ev[k] ? `${d[k]}, ${ev[k]}` : ev[k];
      }
      if (filled(ev.running)) d.running = (typeof d.running === "number" ? d.running : 0) + ev.running;
    } else if (ev.event === "morning") {
      const d = dailyOf(ev.date);
      if (filled(ev.finger_pain)) d.finger_pain = ev.finger_pain;
      if (filled(ev.sleep)) d.sleep = ev.sleep;
      if (filled(ev.finger_pain)) {
        for (const s of sessions) if (s.date === addDays(ev.date, -1) && !filled(s.finger_pain_next_day)) s.finger_pain_next_day = ev.finger_pain;
      }
    }
  }
  return { ...data, sessions, dailies };
}
