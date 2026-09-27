// Every saved event is kept on the phone until the Mac has processed it
// (its id shows up in app-data.json). Status: saved -> sent -> processed.

import * as store from "./store.js";

const KEY = "queue";
const KEEP_PROCESSED = 30;

export async function all() {
  return (await store.get(KEY)) || [];
}

export async function add(entry) {
  const list = await all();
  list.unshift({ ...entry, status: "saved", savedAt: new Date().toISOString() });
  await store.set(KEY, list);
  return list[0];
}

export async function markSent(id) {
  const list = await all();
  for (const e of list) if (e.event.id === id) Object.assign(e, { status: "sent", sentAt: new Date().toISOString() });
  await store.set(KEY, list);
}

// After a sync: events the Mac already turned into notes are "processed";
// only the newest processed ones are kept, as a short history.
export async function reconcile(processedIds) {
  const done = new Set((processedIds || []).map(String));
  const list = await all();
  for (const e of list) if (done.has(String(e.event.id))) e.status = "processed";
  let kept = 0;
  const trimmed = list.filter((e) => e.status !== "processed" || ++kept <= KEEP_PROCESSED);
  await store.set(KEY, trimmed);
  return trimmed;
}

export async function remove(id) {
  await store.set(KEY, (await all()).filter((e) => e.event.id !== id));
}
