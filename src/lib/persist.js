// IndexedDB minimal helpers
const DB_NAME = "npt-db";
const DB_STORE = "sessions";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key, val) {
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

export async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
