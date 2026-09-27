// Hands an event file to the iOS Shortcut, which saves it to iCloud: 00_Inbox/App/.

import * as store from "./store.js";

const NAME_KEY = "shortcutName";
export const DEFAULT_SHORTCUT = "Boulder Save";

export async function shortcutName() {
  return (await store.get(NAME_KEY)) || DEFAULT_SHORTCUT;
}

export async function setShortcutName(name) {
  await store.set(NAME_KEY, name.trim() || DEFAULT_SHORTCUT);
}

// Opens the Shortcuts app. The phone leaves the app here; nothing comes back.
export async function sendViaShortcut({ file, content }) {
  const name = await shortcutName();
  const payload = encodeURIComponent(JSON.stringify({ file, content }));
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${payload}`;
}

// Fallback: the share sheet -> "Save to Files" -> Bouldering/00_Inbox/App.
export async function shareFile({ file, content }) {
  const f = new File([content], file, { type: "text/markdown" });
  if (!navigator.canShare || !navigator.canShare({ files: [f] })) throw new Error("Sharing files is not supported here.");
  await navigator.share({ files: [f] });
}
