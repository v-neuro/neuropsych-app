// IndexedDB minimal helpers
const DB_NAME = "npt-db";
const DB_STORE = "sessions";
const DB_DRAW_STORE = "drawings";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if (!db.objectStoreNames.contains(DB_DRAW_STORE)) db.createObjectStore(DB_DRAW_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetImpl(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelImpl(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ----- Drawings (large payloads kept out of session store) -----
async function idbSetDrawingImpl(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readwrite");
    tx.objectStore(DB_DRAW_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetDrawing(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readonly");
    const req = tx.objectStore(DB_DRAW_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteDrawingImpl(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readwrite");
    tx.objectStore(DB_DRAW_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteDrawingNamespaceImpl(prefix) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readwrite");
    const store = tx.objectStore(DB_DRAW_STORE);
    const req = store.openCursor();
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
        cursor.delete();
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Delete all drawings not matching allowed prefixes (array of strings)
async function idbPruneDrawingsExceptImpl(prefixes = []) {
  const db = await idbOpen();
  const allowed = Array.isArray(prefixes) ? prefixes : [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readwrite");
    const store = tx.objectStore(DB_DRAW_STORE);
    const req = store.openCursor();
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) return;
      const keep = allowed.some((p) => typeof cursor.key === "string" && cursor.key.startsWith(p));
      if (!keep) cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Remove sessions with lastUpdated older than cutoffMs. Optional onDeleteKey callback.
async function idbPruneOldSessionsImpl(cutoffMs, onDeleteKey) {
  if (typeof cutoffMs !== "number" || cutoffMs <= 0) return;
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const now = Date.now();
    const req = store.openCursor();
    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor) return;
      const val = cursor.value || {};
      const updated = typeof val.lastUpdated === "number" ? val.lastUpdated : 0;
      if (now - updated > cutoffMs) {
        const key = cursor.key;
        cursor.delete();
        if (onDeleteKey) onDeleteKey(key);
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const pendingWrites = new Set();
function trackWrite(operation) {
  const promise = operation();
  pendingWrites.add(promise);
  const finished = () => pendingWrites.delete(promise);
  promise.then(finished, finished);
  return promise;
}
export async function waitForPendingStorageWrites() {
  while (pendingWrites.size) await Promise.all([...pendingWrites]);
}
export function idbSet(...args) { return trackWrite(() => idbSetImpl(...args)); }
export function idbDel(...args) { return trackWrite(() => idbDelImpl(...args)); }
export function idbSetDrawing(...args) { return trackWrite(() => idbSetDrawingImpl(...args)); }
export function idbDeleteDrawing(...args) { return trackWrite(() => idbDeleteDrawingImpl(...args)); }
export function idbDeleteDrawingNamespace(...args) { return trackWrite(() => idbDeleteDrawingNamespaceImpl(...args)); }
export function idbPruneDrawingsExcept(...args) { return trackWrite(() => idbPruneDrawingsExceptImpl(...args)); }
export function idbPruneOldSessions(...args) { return trackWrite(() => idbPruneOldSessionsImpl(...args)); }

export async function idbReadAssessmentDrawings(sessionUUID) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_DRAW_STORE, "readonly");
    const drawings = [];
    const request = tx.objectStore(DB_DRAW_STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(`${sessionUUID}:dcsr:`)) drawings.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(drawings); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error("Zeichnungen konnten nicht gelesen werden.")); };
  });
}

async function replaceStoredAssessment(sessionUUID, snapshot, drawings) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DB_STORE, DB_DRAW_STORE], "readwrite");
    const sessions = tx.objectStore(DB_STORE);
    const images = tx.objectStore(DB_DRAW_STORE);
    const previous = { snapshot: undefined, drawings: [] };
    let failure;
    const saved = sessions.get(sessionUUID);
    saved.onsuccess = () => { previous.snapshot = saved.result; };
    const cursorRequest = images.openCursor();
    cursorRequest.onsuccess = () => {
      try {
        const cursor = cursorRequest.result;
        if (cursor) {
          if (typeof cursor.key === "string" && cursor.key.startsWith(`${sessionUUID}:dcsr:`)) {
            previous.drawings.push({ key: cursor.key, value: cursor.value });
            cursor.delete();
          }
          cursor.continue();
        } else {
          for (const drawing of drawings) images.put(drawing.value, drawing.key);
          if (snapshot) sessions.put(snapshot, sessionUUID);
          else sessions.delete(sessionUUID);
        }
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(previous); };
    tx.onerror = tx.onabort = () => { db.close(); reject(failure || tx.error || new Error("Backup konnte nicht gespeichert werden.")); };
  });
}

// Both stores commit together. The caller can roll back if the active-session pointer fails.
export async function idbRestoreAssessment(snapshot, drawings) {
  const previous = await replaceStoredAssessment(snapshot.sessionUUID, snapshot, drawings);
  return () => replaceStoredAssessment(snapshot.sessionUUID, previous.snapshot, previous.drawings);
}

// RWT CSV key definitions + helper
export const RWT_CSV_KEYS = [
  { key: "rwt_phon_einfach_version", path: ["rwt", "phon_simple", "version"], type: "string" },
  { key: "rwt_phon_einfach_summe",   path: ["rwt", "phon_simple", "sum"],     type: "number" },
  { key: "rwt_phon_einfach_notizen", path: ["rwt", "phon_simple", "notes"],   type: "string" },

  { key: "rwt_phon_komplex_version", path: ["rwt", "phon_complex", "version"], type: "string" },
  { key: "rwt_phon_komplex_summe",   path: ["rwt", "phon_complex", "sum"],     type: "number" },
  { key: "rwt_phon_komplex_notizen", path: ["rwt", "phon_complex", "notes"],   type: "string" },

  { key: "rwt_sem_einfach_version",  path: ["rwt", "sem_simple",  "version"], type: "string" },
  { key: "rwt_sem_einfach_summe",    path: ["rwt", "sem_simple",  "sum"],     type: "number" },
  { key: "rwt_sem_einfach_notizen",  path: ["rwt", "sem_simple",  "notes"],   type: "string" },

  { key: "rwt_sem_komplex_version",  path: ["rwt", "sem_complex", "version"], type: "string" },
  { key: "rwt_sem_komplex_summe",    path: ["rwt", "sem_complex", "sum"],     type: "number" },
  { key: "rwt_sem_komplex_notizen",  path: ["rwt", "sem_complex", "notes"],   type: "string" },
];

export function getRwtCsvRows(sessionData) {
  const rows = [];
  for (const def of RWT_CSV_KEYS) {
    const val = def.path.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), sessionData || {});
    if (val !== undefined && val !== null && val !== "") {
      rows.push({ variable: def.key, wert: val });
    }
  }
  return rows;
}

// Generic dot-notation flattener (primitives only)
export function flattenSessionForExport(sessionData) {
  const out = {};
  const visit = (val, prefix) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach((v, i) => visit(v, prefix ? `${prefix}.${i}` : `${i}`));
      return;
    }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        visit(v, prefix ? `${prefix}.${k}` : k);
      }
      return;
    }
    out[prefix] = val;
  };
  visit(sessionData || {}, "");
  return out;
}
