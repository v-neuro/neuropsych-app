import { APP_VERSION } from "./app-version.js";
import { isRasterDataUrl } from "./raster-image.js";
export const MAX_BACKUP_BYTES = 128 * 1024 * 1024;
const FORMAT = "digitale-npt-assessment";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };

async function digest(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function encodeBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
function decodeBase64(text) {
  if (typeof text !== "string" || text.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) fail("Ungültige Zeichnungsdaten im Backup.");
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
function validateJson(value, depth = 0) {
  if (depth > 80) fail("Das Backup ist zu stark verschachtelt.");
  if (typeof value === "number" && !Number.isFinite(value)) fail("Ungültige Zahl im Backup.");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail("Ungültiger Schlüssel im Backup.");
    validateJson(child, depth + 1);
  }
}
function validateSnapshot(snapshot) {
  if (!isObject(snapshot) || !/^[A-Za-z0-9_-]{1,100}$/.test(snapshot.sessionUUID || "")) fail("Ungültige Testungskennung im Backup.");
  if (!isObject(snapshot.sessionData) || !isObject(snapshot.screen) || typeof snapshot.screen.name !== "string") fail("Die Testungsdaten sind unvollständig.");
  if (!Array.isArray(snapshot.globalTimers)) fail("Die Erinnerungen sind unvollständig.");
  for (const timer of snapshot.globalTimers) {
    if (!isObject(timer) || typeof timer.id !== "string" || !Number.isFinite(timer.startTs)
      || (!timer.untimed && (!Number.isFinite(timer.durationMs) || timer.durationMs < 0))) fail("Ungültige Erinnerung im Backup.");
  }
  if (snapshot.activePipeline != null && (!isObject(snapshot.activePipeline) || !Array.isArray(snapshot.activePipeline.steps)
    || !Number.isInteger(snapshot.activePipeline.index) || snapshot.activePipeline.index < 0
    || snapshot.activePipeline.index >= snapshot.activePipeline.steps.length)) fail("Ungültiger Testbatterie-Fortschritt im Backup.");
  validateJson(snapshot);
  const legacyDrawings = snapshot.sessionData.dcsr?.drawings;
  if (legacyDrawings != null && (!Array.isArray(legacyDrawings)
    || legacyDrawings.some((image) => image != null && image !== "" && !isRasterDataUrl(image)))) {
    fail("Ungültige Zeichnung im Backup.");
  }
}
function expectedDrawingKeys(snapshot) {
  const dcsr = snapshot.sessionData.dcsr || {};
  if ((dcsr.drawingKeys != null && !Array.isArray(dcsr.drawingKeys)) || (dcsr.drawingGalleryKeys != null && !Array.isArray(dcsr.drawingGalleryKeys))) fail("Ungültige Zeichnungsverweise im Backup.");
  const keys = new Set((dcsr.drawingKeys || []).filter(Boolean));
  for (const group of dcsr.drawingGalleryKeys || []) {
    if (group != null && !Array.isArray(group)) fail("Ungültige Figurengalerie im Backup.");
    for (const entry of group || []) keys.add(typeof entry === "string" ? entry : entry?.key);
  }
  return keys;
}
function payloadOf(backup) {
  const { format, schemaVersion, createdAt, appVersion, snapshot, drawings } = backup;
  return { format, schemaVersion, createdAt, appVersion, snapshot, drawings };
}

export async function createAssessmentBackup(snapshot, drawings) {
  // Older sessions can contain embedded raster Blobs before their first DCS reopen.
  const copied = structuredClone(snapshot);
  const legacy = copied.sessionData?.dcsr?.drawings;
  if (Array.isArray(legacy)) {
    copied.sessionData.dcsr.drawings = await Promise.all(legacy.map(async (image) => image instanceof Blob
      ? `data:${image.type || "image/png"};base64,${encodeBase64(new Uint8Array(await image.arrayBuffer()))}` : image));
  }
  // JSON serialization removes optional undefined fields, exactly as persisted backups do.
  const cleanSnapshot = JSON.parse(JSON.stringify(copied));
  validateSnapshot(cleanSnapshot);
  const encoded = await Promise.all(drawings.map(async ({ key, value }) => {
    if (value instanceof Blob) return { key, kind: "blob", mime: value.type, data: encodeBase64(new Uint8Array(await value.arrayBuffer())) };
    if (typeof value === "string") return { key, kind: "string", data: value };
    fail("Eine Zeichnung konnte nicht gesichert werden.");
  }));
  const backup = {
    format: FORMAT, schemaVersion: 1, createdAt: new Date().toISOString(), appVersion: APP_VERSION,
    snapshot: cleanSnapshot, drawings: encoded,
  };
  const json = JSON.stringify({ ...backup, checksum: await digest(JSON.stringify(backup)) });
  if (new Blob([json]).size > MAX_BACKUP_BYTES) fail("Das Backup ist größer als 128 MB.");
  // Validate our own output too, including all required drawing references.
  await parseAssessmentBackup(json);
  return json;
}

export async function parseAssessmentBackup(text) {
  if (typeof text !== "string" || new Blob([text]).size > MAX_BACKUP_BYTES) fail("Das Backup ist größer als 128 MB.");
  let backup;
  try { backup = JSON.parse(text); } catch { fail("Die Datei enthält kein lesbares Backup."); }
  if (!isObject(backup) || backup.format !== FORMAT) fail("Diese Datei ist kein vollständiges NPT-Backup.");
  if (backup.schemaVersion !== 1) fail("Diese Backup-Version wird von dieser App nicht unterstützt.");
  validateJson(backup);
  if (typeof backup.createdAt !== "string" || !Number.isFinite(Date.parse(backup.createdAt)) || typeof backup.appVersion !== "string") fail("Die Backup-Angaben sind unvollständig.");
  if (typeof backup.checksum !== "string" || backup.checksum !== await digest(JSON.stringify(payloadOf(backup)))) fail("Das Backup ist beschädigt oder wurde verändert.");
  validateSnapshot(backup.snapshot);
  if (!Array.isArray(backup.drawings)) fail("Die Zeichnungen sind unvollständig.");
  const namespace = `${backup.snapshot.sessionUUID}:dcsr:`;
  const seen = new Set();
  const drawings = backup.drawings.map((drawing) => {
    if (!isObject(drawing) || typeof drawing.key !== "string" || !drawing.key.startsWith(namespace) || seen.has(drawing.key)) fail("Ungültige Zeichnungszuordnung im Backup.");
    seen.add(drawing.key);
    if (drawing.kind === "blob" && ["image/png", "image/jpeg", "image/webp"].includes(drawing.mime)) {
      return { key: drawing.key, value: new Blob([decodeBase64(drawing.data)], { type: drawing.mime }) };
    }
    if (drawing.kind === "string" && isRasterDataUrl(drawing.data)) {
      decodeBase64(drawing.data.split(",")[1]);
      return { key: drawing.key, value: drawing.data };
    }
    fail("Ungültige Zeichnung im Backup.");
  });
  for (const key of expectedDrawingKeys(backup.snapshot)) {
    // Empty current canvases may retain a key after deletion; gallery entries may not.
    if (typeof key !== "string" || !key.startsWith(namespace)) fail("Ungültiger Zeichnungsverweis im Backup.");
  }
  for (const group of backup.snapshot.sessionData.dcsr?.drawingGalleryKeys || []) {
    for (const entry of group || []) if (!seen.has(typeof entry === "string" ? entry : entry.key)) fail("Eine gespeicherte Figur fehlt im Backup.");
  }
  return { ...backup, drawings };
}
