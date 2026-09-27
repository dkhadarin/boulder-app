// Tiny key-value store on IndexedDB. Falls back to memory when IndexedDB is
// unavailable (private mode, blocked storage), so the app still renders.

const DB_NAME = "boulder";
const STORE = "kv";
const memory = new Map();
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request(mode, run) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function get(key) {
  try {
    const value = await request("readonly", (s) => s.get(key));
    return value === undefined ? memory.get(key) : value;
  } catch {
    return memory.get(key);
  }
}

export async function set(key, value) {
  memory.set(key, value);
  try {
    await request("readwrite", (s) => s.put(value, key));
  } catch {
    // memory copy is enough for this session
  }
}
