import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";

// Run npm run build first. This server simulates offline operation and two deployments.
const files = new Map();
async function collect(directory, prefix = "", target = files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(`${directory}/${entry.name}`, `${relative}/`, target);
    else target.set(`/${relative}`, await readFile(`${directory}/${entry.name}`));
  }
}
await collect(new URL("../dist", import.meta.url).pathname);
const baselineFiles = new Map();
if (process.env.NPT_BASELINE_DIST) await collect(process.env.NPT_BASELINE_DIST, "", baselineFiles);
const worker = files.get("/sw.js").toString();
const version = worker.match(/CACHE_PREFIX\}([a-f0-9]+)/)[1];
let release = "initial";
let online = true;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = path === "/" ? "/index.html" : path;
  if (!online || (release === "broken" && file === "/material/DCS-2.png")) {
    response.writeHead(503).end("Offline test"); return;
  }
  let content = (release === "baseline" ? baselineFiles : files).get(file);
  if (!content) { response.writeHead(404).end(); return; }
  if (file === "/sw.js" && ["broken", "updated"].includes(release)) content = worker.replace(version, `${version}-${release}`);
  if (file === "/sw.js" && release === "updated") {
    const html = files.get("/index.html").toString();
    const updated = html.replace("</head>", '<meta name="npt-test-release" content="updated"></head>');
    content = content.replace(createHash("sha256").update(html).digest("hex"), createHash("sha256").update(updated).digest("hex"));
  }
  if (file === "/index.html" && release === "updated") {
    content = content.toString().replace("</head>", '<meta name="npt-test-release" content="updated"></head>');
  }
  const extension = file.split(".").at(-1);
  const type = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", svg: "image/svg+xml", webmanifest: "application/manifest+json" }[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(content);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const appUrl = `http://127.0.0.1:${server.address().port}`;

// Uses an isolated browser context with synthetic data.
const debugUrl = process.env.NPT_CDP_URL || "http://127.0.0.1:9227";
const { webSocketDebuggerUrl } = await (await fetch(`${debugUrl}/json/version`)).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, 10_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function until(check, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}

const { browserContextId } = await send("Target.createBrowserContext");
const browserErrors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails);
});
async function page({ persistent = true, contextId = browserContextId } = {}) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId: contextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Page.bringToFront", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const click = (label) => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)});
    button.click();
  })()`);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.persistenceRequests = 0;
    Object.defineProperty(navigator.storage, 'persisted', { configurable: true, value: async () => false });
    Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: async () => { window.persistenceRequests++; return ${persistent}; } });
    if (location.origin === ${JSON.stringify(appUrl)} && !localStorage.getItem('pwa_fixture_seeded')) {
      localStorage.setItem('pwa_fixture_seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      localStorage.setItem('sessionUUID', 'pwa-regression');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'pwa-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
        sessionData: {
          demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', education_years: 11.5, education_years_manual: true },
          dcsr: { step: 'dg', ver: 'V1', dg: 2, counts: [{ richtig: 0 }] }
        }
      }));
    }
  ` }, sessionId);
  return { targetId, sessionId, evaluate, click, snapshot: () => evaluate('JSON.parse(localStorage.getItem("npt_session_backup"))') };
}
const navigate = (p) => send("Page.navigate", { url: appUrl }, p.sessionId);
const hydrated = (p) => until(() => p.evaluate('!!document.querySelector(".tile-btn:not(:disabled)") || !!document.querySelector("canvas")'), "app hydration");
async function setOffline(p, offline) {
  online = !offline;
  await send("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, p.sessionId);
}
async function checkExports(p) {
  await p.evaluate(`(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { if (blob.type.startsWith('text/csv')) window.offlineCsv = blob.text(); return original(blob); };
    HTMLAnchorElement.prototype.click = function() {};
    window.open = () => ({ document: { write: html => { window.offlinePdf = html; }, close() {}, open() {} } });
  })()`);
  await p.click("CSV Export");
  await until(() => p.evaluate('!!window.offlineCsv'), "offline CSV");
  const [headers, values] = (await p.evaluate('window.offlineCsv')).split("\n").map(line => line.split(";"));
  assert.equal(values[headers.indexOf("demographics_education_years")], '"11.5"');
  assert.equal(values[headers.indexOf("dcsr_dg1_hits")], '"0"');
  await p.click("PDF Export");
  await until(() => p.evaluate('window.offlinePdf?.includes("demographics_education_years")'), "offline PDF");
}

async function checkStandalonePdf(p, mode) {
  const before = await p.snapshot();
  const previousTitle = await p.evaluate('document.title');
  await p.evaluate(`(() => {
    window.originalMatchMedia = window.matchMedia;
    if (${JSON.stringify(mode)} === 'ios') Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    else window.matchMedia = query => {
      const result = window.originalMatchMedia.call(window, query);
      if (query === '(display-mode: standalone)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
    window.open = () => { throw new Error('Standalone PDF must not open another window'); };
    window.printCalls = 0;
    window.print = () => { window.printCalls++; window.dispatchEvent(new Event('afterprint')); };
  })()`);
  await p.click("PDF Export");
  await until(() => p.evaluate('!!document.querySelector("#npt-pdf-export[open] .npt-pdf-report") && ![...document.querySelectorAll("#npt-pdf-export button")].find(node => node.textContent.includes("Drucken")).disabled'), "in-app PDF preview");
  assert.equal(await p.evaluate('document.querySelector("#npt-pdf-export").contains(document.activeElement)'), true);
  assert.equal(await p.evaluate('document.querySelector("#npt-pdf-export").textContent.includes("demographics_education_years")'), true);
  assert.equal(await p.evaluate('document.querySelectorAll("#npt-pdf-export img").length > 0'), true);
  assert.equal(await p.evaluate('[...document.querySelectorAll("#npt-pdf-export img")].every(image => image.complete && image.naturalWidth > 0)'), true);
  await p.evaluate('document.querySelector(".npt-export-scroll").scrollTop = 100000');
  assert.equal(await p.evaluate('document.querySelector(".npt-export-toolbar").getBoundingClientRect().top >= 0'), true);
  await send("Emulation.setEmulatedMedia", { media: "print" }, p.sessionId);
  assert.equal(await p.evaluate('getComputedStyle(document.getElementById("root")).display'), "none");
  assert.equal(await p.evaluate('getComputedStyle(document.querySelector(".npt-export-toolbar")).display'), "none");
  assert.equal(await p.evaluate('getComputedStyle(document.querySelector(".npt-pdf-report")).display'), "block");
  const pdf = await send("Page.printToPDF", { printBackground: true }, p.sessionId);
  assert.equal(Buffer.from(pdf.data, "base64").subarray(0, 4).toString(), "%PDF");
  assert.ok(Buffer.from(pdf.data, "base64").length > 1000);
  await send("Emulation.setEmulatedMedia", { media: "screen" }, p.sessionId);
  await p.click("Drucken / Als PDF sichern");
  assert.equal(await p.evaluate('window.printCalls'), 1);
  assert.equal(await p.evaluate('!!document.querySelector("#npt-pdf-export[open]")'), true);
  await p.click("← Zurück zur Testung");
  await until(() => p.evaluate('!document.getElementById("npt-pdf-export")'), "return to assessment");
  assert.equal(await p.evaluate('document.title'), previousTitle);
  assert.equal(await p.evaluate('document.body.classList.contains("npt-print-preview")'), false);
  assert.deepEqual((await p.snapshot()).sessionData, before.sessionData);
  assert.deepEqual((await p.snapshot()).screen, before.screen);
  assert.equal(await p.evaluate('!!document.querySelector("canvas")'), true);
  await p.click("PDF Export");
  await until(() => p.evaluate('!!document.querySelector("#npt-pdf-export[open]")'), "reopened preview");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, p.sessionId);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, p.sessionId);
  await until(() => p.evaluate('!document.getElementById("npt-pdf-export")'), "escape preview");
  await delay(100);
  assert.equal(await p.evaluate('!!document.getElementById("npt-pdf-export")'), false);
  await p.evaluate(`delete navigator.standalone; window.matchMedia = window.originalMatchMedia;`);
}

async function checkStandaloneCsv(p) {
  const before = await p.snapshot();
  const previousTitle = await p.evaluate('document.title');
  const previousUrl = await p.evaluate('location.href');
  await p.evaluate(`(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => window.shareOutcome !== 'unsupported' && files.length === 1 && files[0].type === 'text/csv' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
      window.sharedFile = { name: files[0].name, type: files[0].type, activated: navigator.userActivation.isActive, text: await files[0].text() };
      if (window.shareOutcome === 'cancel') throw new DOMException('Cancelled', 'AbortError');
      if (window.shareOutcome === 'error') throw new DOMException('Failed', 'DataError');
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.copyFails) throw new DOMException('Denied', 'NotAllowedError');
      window.copiedCsv = text;
    } } });
    HTMLAnchorElement.prototype.click = () => { throw new Error('Standalone CSV must not navigate to a download'); };
  })()`);
  for (const outcome of ['success', 'cancel', 'error', 'unsupported']) {
    await p.evaluate(`window.shareOutcome = ${JSON.stringify(outcome)}; window.copyFails = false; window.copiedCsv = null;`);
    await p.click('CSV Export');
    await until(() => p.evaluate('!!document.querySelector("#npt-csv-export[open] textarea")'), 'in-app CSV preview');
    const csv = await p.evaluate('document.getElementById("npt-csv-content").value');
    assert.ok(csv.startsWith('session_uuid;'));
    if (outcome !== 'unsupported') {
      const rect = await p.evaluate(`(() => {
        const button = [...document.querySelectorAll('#npt-csv-export button')].find(node => node.textContent === 'CSV teilen / In Dateien sichern');
        const rect = button.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      // A real click verifies that file sharing retains the required user activation.
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...rect, button: 'left', buttons: 1, clickCount: 1 }, p.sessionId);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...rect, button: 'left', buttons: 0, clickCount: 1 }, p.sessionId);
      await until(() => p.evaluate(`!!window.sharedFile && ![...document.querySelectorAll('#npt-csv-export button')].find(node => node.textContent.includes('CSV teilen')).disabled`), 'share result');
      const shared = await p.evaluate('window.sharedFile');
      assert.equal(shared.text, csv);
      assert.equal(shared.activated, true);
      assert.ok(shared.name.endsWith('_TEST_pwa-regression.csv'));
      assert.equal(shared.type, 'text/csv');
      assert.equal(await p.evaluate('!!document.querySelector("#npt-csv-export[open]")'), true);
      if (outcome === 'error') assert.equal(await p.evaluate('document.getElementById("npt-csv-export").textContent.includes("Teilen nicht möglich")'), true);
    } else {
      assert.equal(await p.evaluate(`[...document.querySelectorAll('#npt-csv-export button')].some(node => node.textContent.includes('CSV teilen'))`), false);
    }
    await p.click('CSV kopieren');
    await until(() => p.evaluate('!!window.copiedCsv'), 'copy CSV');
    assert.equal(await p.evaluate('window.copiedCsv'), csv);
    if (outcome === 'unsupported') {
      await p.evaluate('window.copyFails = true');
      await p.click('CSV kopieren');
      await until(() => p.evaluate('document.getElementById("npt-csv-export").textContent.includes("ausgewählten CSV-Inhalt")'), 'manual copy fallback');
      assert.equal(await p.evaluate('document.getElementById("npt-csv-content").selectionEnd'), csv.length);
    }
    await p.click('← Zurück zur Testung');
    await until(() => p.evaluate('!document.getElementById("npt-csv-export")'), 'return from CSV');
    assert.equal(await p.evaluate('location.href'), previousUrl);
    assert.equal(await p.evaluate('document.title'), previousTitle);
    assert.deepEqual((await p.snapshot()).sessionData, before.sessionData);
    assert.deepEqual((await p.snapshot()).screen, before.screen);
    await p.evaluate('window.sharedFile = null');
  }
  await p.evaluate('delete navigator.standalone');
}

async function checkFullBackup(p) {
  const directory = await mkdtemp('/private/tmp/npt-backup-test-');
  try {
    assert.equal(await p.evaluate(`!![...document.querySelectorAll('button')].find(node => node.textContent === 'Backup erstellen')`), false);
    assert.equal(await p.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent === 'Backup');
      return button.previousElementSibling.textContent.trim();
    })()`), 'Testungsaufbau für Fragestellungen');
    await p.evaluate(`[...document.querySelectorAll('button')].find(node => node.textContent === 'Backup').focus()`);
    await p.click('Backup');
    await until(() => p.evaluate('!!document.querySelector("dialog[open][aria-labelledby=backup-menu-title]")'), 'compact backup menu');
    assert.equal(await p.evaluate(`document.querySelector('dialog[aria-labelledby=backup-menu-title]').getBoundingClientRect().width < innerWidth`), true);
    await p.click('Schließen');
    assert.equal(await p.evaluate('!!document.querySelector("dialog[open]")'), false);
    assert.equal(await p.evaluate('document.activeElement.textContent'), 'Backup');
    await p.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const rect = await p.evaluate(`(() => {
      const canvas = document.querySelector('canvas'); canvas.scrollIntoView({ block: 'center' });
      const r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    const start = { x: rect.x + rect.width * 0.2, y: rect.y + rect.height * 0.3 };
    const finish = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.6 };
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 }, p.sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...finish, button: 'left', buttons: 1 }, p.sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...finish, button: 'left', buttons: 0, clickCount: 1 }, p.sessionId);
    await p.evaluate(`(() => {
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => { window.sharedBackupName = files[0].name; window.sharedBackup = await files[0].text(); } });
    })()`);
    await p.evaluate(`(() => {
      const original = IDBObjectStore.prototype.put;
      window.failDrawingWrites = 2;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'drawings' && window.failDrawingWrites > 0) {
          window.failDrawingWrites--; throw new DOMException('Synthetic drawing failure', 'QuotaExceededError');
        }
        return original.apply(this, args);
      };
    })()`);
    await p.click('Backup');
    await p.click('Backup erstellen');
    await until(() => p.evaluate('document.getElementById("npt-backup")?.textContent.includes("aktuelle Zeichnung konnte nicht vollständig")'), 'failed draft flush rejects backup');
    assert.equal(await p.evaluate('!!document.querySelector("#npt-backup textarea")'), false);
    await p.evaluate('window.failDrawingWrites = 0');
    await p.click('← Zurück zur Testung');
    await p.click('Backup');
    await p.click('Backup erstellen');
    await until(() => p.evaluate('!!document.querySelector("#npt-backup textarea")'), 'complete backup with active sketch');
    const text = await p.evaluate('document.querySelector("#npt-backup textarea").value');
    const backup = JSON.parse(text);
    assert.equal(backup.drawings.length, 2);
    assert.equal(backup.snapshot.sessionData.demographics.education_years, 11.5);
    assert.equal(backup.snapshot.sessionData.dcsr.counts[1].richtig, 1);
    assert.equal(backup.snapshot.screen.name, 'dcsr');
    assert.equal(backup.appVersion, await p.evaluate('document.querySelector("[data-app-version]").dataset.appVersion'));
    await p.click('Backup teilen / In Dateien sichern');
    await until(() => p.evaluate('!!window.sharedBackup'), 'share full backup');
    assert.equal(await p.evaluate('window.sharedBackup'), text);
    await writeFile(`${directory}/valid.npt-backup.json`, text);
    const damaged = JSON.parse(text); damaged.snapshot.sessionData.demographics.education_years = 12;
    await writeFile(`${directory}/damaged.npt-backup.json`, JSON.stringify(damaged));
    await p.click('← Zurück zur Testung');
    await p.evaluate(`Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => files[0].type === 'text/plain' }); window.sharedBackup = null;`);
    await p.click('Backup');
    await p.click('Backup erstellen');
    await until(() => p.evaluate('!!document.querySelector("#npt-backup textarea")'), 'plain-text share fallback');
    await p.click('Backup teilen / In Dateien sichern');
    await until(() => p.evaluate('!!window.sharedBackup'), 'plain-text backup shared');
    assert.ok((await p.evaluate('window.sharedBackupName')).endsWith('.npt-backup.txt'));
    assert.deepEqual(JSON.parse(await p.evaluate('window.sharedBackup')).snapshot.sessionData, backup.snapshot.sessionData);
    await p.click('← Zurück zur Testung');
    await p.evaluate(`Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); window.copyFails = true;`);
    await p.click('Backup');
    await p.click('Backup erstellen');
    await until(() => p.evaluate('!!document.querySelector("#npt-backup textarea")'), 'copy backup fallback');
    await p.click('Backup kopieren');
    await until(() => p.evaluate('document.querySelector("#npt-backup details").open'), 'manual backup copy exposed');
    assert.equal(await p.evaluate('document.activeElement === document.querySelector("#npt-backup textarea")'), true);
    assert.equal(await p.evaluate('document.querySelector("#npt-backup textarea").selectionEnd === document.querySelector("#npt-backup textarea").value.length'), true);
    await p.click('← Zurück zur Testung');
    await p.evaluate(`(() => {
      delete navigator.standalone;
      const original = URL.createObjectURL;
      URL.createObjectURL = file => { if (file.name?.endsWith('.npt-backup.json')) window.downloadedBackup = file.text(); return original(file); };
      HTMLAnchorElement.prototype.click = function() { window.downloadedBackupName = this.download; };
    })()`);
    await p.click('Backup');
    await p.click('Backup erstellen');
    await until(() => p.evaluate('!!document.querySelector("#npt-backup textarea")'), 'browser backup');
    await p.click('Backup herunterladen');
    await until(() => p.evaluate('!!window.downloadedBackup'), 'browser backup download');
    assert.deepEqual(JSON.parse(await p.evaluate('window.downloadedBackup')).snapshot.sessionData, backup.snapshot.sessionData);
    assert.ok((await p.evaluate('window.downloadedBackupName')).endsWith('.npt-backup.json'));
    await p.click('← Zurück zur Testung');
    await p.click('Übersicht');
    await p.click('Basisdaten bearbeiten');
    await until(() => p.evaluate('!!document.getElementById("education-years-total")'), 'education form');
    await p.evaluate(`(() => {
      const input = document.getElementById('education-years-total');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '99');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await p.click('Speichern');
    await until(async () => (await p.snapshot()).sessionData.demographics.education_years === 99, 'changed live assessment');
    const loadFile = async (name) => {
      await p.click('Backup');
      await until(() => p.evaluate('!!document.querySelector("dialog[open][aria-labelledby=backup-menu-title]")'), 'backup import menu');
      const { root } = await send('DOM.getDocument', {}, p.sessionId);
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[aria-label="Backup-Datei laden"]' }, p.sessionId);
      await send('DOM.setFileInputFiles', { nodeId, files: [`${directory}/${name}`] }, p.sessionId);
    };
    await loadFile('damaged.npt-backup.json');
    await until(() => p.evaluate('document.getElementById("npt-backup")?.textContent.includes("beschädigt")'), 'damaged backup rejected');
    assert.equal((await p.snapshot()).sessionData.demographics.education_years, 99);
    assert.equal(await p.evaluate(`[...document.querySelectorAll('#npt-backup button')].find(node => node.textContent === 'Backup wiederherstellen').disabled`), true);
    await p.click('← Zurück zur Testung');
    await loadFile('valid.npt-backup.json');
    await until(() => p.evaluate(`[...document.querySelectorAll('#npt-backup button')].some(node => node.textContent === 'Backup wiederherstellen' && !node.disabled)`), 'valid restore reviewed');
    await p.evaluate(`(() => {
      const original = IDBObjectStore.prototype.put;
      window.failRestoreOnce = true;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'drawings' && window.failRestoreOnce) {
          window.failRestoreOnce = false; throw new DOMException('Synthetic restore failure', 'QuotaExceededError');
        }
        return original.apply(this, args);
      };
    })()`);
    await p.click('Backup wiederherstellen');
    await until(() => p.evaluate('document.getElementById("npt-backup")?.textContent.includes("Synthetic restore failure")'), 'atomic failed restore');
    assert.equal((await p.snapshot()).sessionData.demographics.education_years, 99);
    assert.equal(await p.evaluate(`new Promise(resolve => {
      const open = indexedDB.open('npt-db', 2);
      open.onsuccess = () => { const db = open.result; const read = db.transaction('sessions').objectStore('sessions').get('pwa-regression'); read.onsuccess = () => { resolve(read.result.sessionData.demographics.education_years); db.close(); }; };
    })`), 99);
    await p.evaluate(`(() => {
      const original = Storage.prototype.setItem;
      window.failPointerOnce = true;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'sessionUUID' && window.failPointerOnce) {
          window.failPointerOnce = false; throw new DOMException('Synthetic pointer failure', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    })()`);
    await p.click('Backup wiederherstellen');
    await until(() => p.evaluate('document.getElementById("npt-backup")?.textContent.includes("Synthetic pointer failure")'), 'restore pointer rollback');
    assert.equal((await p.snapshot()).sessionData.demographics.education_years, 99);
    assert.equal(await p.evaluate(`new Promise(resolve => {
      const open = indexedDB.open('npt-db', 2);
      open.onsuccess = () => { const db = open.result; const read = db.transaction('sessions').objectStore('sessions').get('pwa-regression'); read.onsuccess = () => { resolve(read.result.sessionData.demographics.education_years); db.close(); }; };
    })`), 99);
    await p.click('Backup wiederherstellen');
    await delay(300);
    await hydrated(p);
    await until(() => p.evaluate('!!document.querySelector("canvas")'), 'restored assessment screen');
    const restored = await p.snapshot();
    assert.deepEqual(restored.sessionData, backup.snapshot.sessionData);
    assert.deepEqual(restored.globalTimers, backup.snapshot.globalTimers);
    assert.deepEqual(restored.screen, backup.snapshot.screen);
    await until(() => p.evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((byte, index) => index % 4 === 3 && byte > 0);
    })()`), 'restored sketch');
    await p.evaluate('delete navigator.standalone');
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function checkRealBuildUpgrade() {
  if (!baselineFiles.size) return;
  const oldVersion = baselineFiles.get('/sw.js').toString().match(/const APP_VERSION = "([^"]+)"/)[1];
  const newVersion = worker.match(/const APP_VERSION = "([^"]+)"/)[1];
  assert.notEqual(oldVersion, newVersion, 'baseline must be a different actual app build');
  const { browserContextId: contextId } = await send('Target.createBrowserContext');
  const drawingSnapshot = (p) => p.evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('npt-db', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('drawings'), store = tx.objectStore('drawings');
      const keys = store.getAllKeys(), values = store.getAll();
      tx.oncomplete = async () => {
        db.close();
        resolve(await Promise.all(values.result.map(async (value, index) => ({ key: keys.result[index],
          bytes: [...new Uint8Array(value instanceof Blob ? await value.arrayBuffer() : new TextEncoder().encode(value))] }))));
      };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  try {
    release = 'baseline'; online = true;
    const old = await page({ contextId });
    await navigate(old); await hydrated(old);
    await until(() => old.evaluate('!!navigator.serviceWorker.controller && document.querySelector("[data-offline-status]")?.textContent.includes("Für Offlinebetrieb bereit")'), 'baseline installation');
    assert.equal(await old.evaluate('document.querySelector("[data-app-version]").dataset.appVersion'), oldVersion);
    await old.evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("DCS-R")).click()');
    await until(() => old.evaluate('!!document.querySelector("canvas") && [...document.querySelectorAll("main img")].every(img => img.complete && img.naturalWidth > 0)'), 'baseline drawing screen');
    const rect = await old.evaluate('(() => { const canvas = document.querySelector("canvas"); canvas.scrollIntoView({ block: "center" }); const r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x + rect.width * .2, y: rect.y + rect.height * .3, button: 'left', buttons: 1, clickCount: 1 }, old.sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.width * .6, y: rect.y + rect.height * .6, button: 'left', buttons: 1 }, old.sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + rect.width * .6, y: rect.y + rect.height * .6, button: 'left', buttons: 0, clickCount: 1 }, old.sessionId);
    await until(async () => !!(await old.snapshot()).sessionData.dcsr.drawingKeys?.[1], 'baseline drawing persisted');
    await old.evaluate('(() => { const label = [...document.querySelectorAll("div")].find(node => node.textContent === "Richtig"); label.parentElement.parentElement.querySelector("button").click(); })()');
    await until(async () => (await old.snapshot()).sessionData.dcsr.counts[1].richtig === 1, 'baseline score');
    await old.click('Backup'); await old.click('Backup erstellen');
    await until(() => old.evaluate('!!document.querySelector("#npt-backup textarea")'), 'backup generated by old app');
    const backupText = await old.evaluate('document.querySelector("#npt-backup textarea").value');
    const expected = JSON.parse(backupText).snapshot;
    const drawings = await drawingSnapshot(old);
    assert.ok(drawings.some(drawing => drawing.bytes.length > 0));
    await old.click('← Zurück zur Testung');
    const second = await page({ contextId }); await navigate(second);
    await until(() => second.evaluate('document.body.textContent.includes("Testung bereits geöffnet")'), 'baseline second tab blocked');
    await old.evaluate('window.realUpgradeSentinel = "old-window"');
    release = 'real-new';
    await old.click('Nach Updates suchen');
    await until(() => old.evaluate('navigator.serviceWorker.getRegistration().then(reg => !!reg.waiting)'), 'real new build waiting');
    assert.equal(await old.evaluate('document.querySelector("[data-app-version]").dataset.appVersion'), oldVersion);
    assert.equal(await old.evaluate('window.realUpgradeSentinel'), 'old-window');
    await send('Target.closeTarget', { targetId: old.targetId });
    assert.equal(await second.evaluate('navigator.serviceWorker.getRegistration().then(reg => !!reg.waiting)'), true);
    await send('Target.closeTarget', { targetId: second.targetId });
    await delay(500);
    const updated = await page({ contextId }); await setOffline(updated, true); await navigate(updated); await hydrated(updated);
    await until(() => updated.evaluate(`document.querySelector('[data-app-version]')?.dataset.appVersion === ${JSON.stringify(newVersion)}`), 'new build activated offline');
    assert.deepEqual((await updated.snapshot()).sessionData, expected.sessionData);
    assert.deepEqual((await updated.snapshot()).screen, expected.screen);
    assert.deepEqual(await drawingSnapshot(updated), drawings);
    await checkExports(updated);
    await updated.click('Übersicht'); await updated.click('Basisdaten bearbeiten');
    await until(() => updated.evaluate('!!document.getElementById("education-years-total")'), 'new-build demographics');
    await updated.evaluate('(() => { const input = document.getElementById("education-years-total"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"99"); input.dispatchEvent(new Event("input",{bubbles:true})); })()');
    await updated.click('Speichern');
    await until(async () => (await updated.snapshot()).sessionData.demographics.education_years === 99, 'new-build assessment changed');
    await updated.click('Backup');
    await updated.evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(backupText)}], 'old-build.npt-backup.json', { type: 'application/json' })); const input = document.querySelector('input[aria-label="Backup-Datei laden"]'); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await until(() => updated.evaluate('[...document.querySelectorAll("#npt-backup button")].some(button => button.textContent === "Backup wiederherstellen" && !button.disabled)'), 'old backup reviewed in new app');
    const previousDocument = await updated.evaluate('performance.timeOrigin');
    await updated.click('Backup wiederherstellen');
    await until(() => updated.evaluate(`performance.timeOrigin !== ${JSON.stringify(previousDocument)} && !!document.querySelector('canvas')`), 'old backup restored and app reloaded offline');
    assert.deepEqual((await updated.snapshot()).sessionData, expected.sessionData);
    assert.deepEqual(await drawingSnapshot(updated), drawings);
    await checkExports(updated);
    console.log('PASS: actual old-to-new build upgrade waits for every window, activates offline, preserves drawing bytes/scores, and restores an old-build backup with matching exports.');
  } finally {
    await send('Target.disposeBrowserContext', { browserContextId: contextId });
    release = 'initial'; online = true;
  }
}

try {
  await checkRealBuildUpgrade();
  release = "broken";
  let editor = await page();
  await navigate(editor);
  await hydrated(editor);
  await until(() => editor.evaluate('document.body.textContent.includes("Offline-Version nicht verfügbar")'), "failed initial download");
  assert.deepEqual(await editor.evaluate('caches.keys()'), []);
  release = "initial";
  await editor.click("Erneut herunterladen");
  await until(() => editor.evaluate('!!navigator.serviceWorker.controller && document.querySelector("[data-offline-status]")?.textContent.includes("Für Offlinebetrieb bereit")'), "retry initial download");
  assert.match(await editor.evaluate('document.querySelector("[data-app-version]").dataset.appVersion'), /^[a-f0-9]{12}$/);
  assert.equal(await editor.evaluate('window.persistenceRequests'), 1);
  assert.equal(await editor.evaluate('document.body.textContent.includes("Dauerhafter Gerätespeicher aktiviert")'), true);
  await editor.click('Nach Updates suchen');
  await until(() => editor.evaluate('document.body.textContent.includes("Die App ist auf dem neuesten Stand")'), 'manual update check');
  console.log("PASS: failed initial download is reported and retry installs the complete app");
  const { data, errors } = await send("Page.getAppManifest", {}, editor.sessionId);
  assert.deepEqual(errors, []);
  const manifest = JSON.parse(data);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons.length, 3);
  assert.equal(await editor.evaluate('document.querySelector("link[rel=apple-touch-icon]").getAttribute("href")'), "/icons/apple-touch-icon.png");
  const staticCache = await editor.evaluate('caches.keys()');
  assert.equal(staticCache.length, 1);
  const assetPaths = await editor.evaluate(`caches.open(${JSON.stringify(staticCache[0])}).then(cache => cache.keys()).then(keys => keys.map(key => new URL(key.url).pathname))`);
  assert.equal(assetPaths.filter(path => path.startsWith("/material/")).length, 4);
  assert.equal(assetPaths.some(path => /patient|session|export/.test(path)), false);
  console.log("PASS: installable manifest, iPad icon, complete static cache, and offline readiness");

  await setOffline(editor, true);
  await send("Page.reload", {}, editor.sessionId);
  await delay(300);
  await hydrated(editor);
  assert.equal((await editor.snapshot()).sessionData.demographics.education_years, 11.5);
  assert.equal(await editor.evaluate('document.body.textContent.includes("Offline – Testung und Export sind verfügbar")'), true);
  for (const path of assetPaths.filter(path => path.startsWith("/material/") || path.startsWith("/icons/"))) {
    assert.equal(await editor.evaluate(`new Promise((resolve) => {
      const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0); image.onerror = () => resolve(false); image.src = ${JSON.stringify(path)};
    })`), true, path);
  }
  await editor.evaluate(`(async () => {
    const cache = await caches.open(${JSON.stringify(staticCache[0])});
    await cache.delete('/material/DCS-2.png');
    await cache.put('/material/DCS-1.png', new Response('damaged', { headers: { 'Content-Type': 'image/png' } }));
  })()`);
  await editor.click('Nach Updates suchen');
  await until(() => editor.evaluate('document.body.textContent.includes("Offline-Version nicht verfügbar")'), 'missing/corrupt cache detected offline');
  assert.equal(await editor.evaluate('document.body.textContent.includes("Offline – Testung und Export sind verfügbar")'), false);
  await setOffline(editor, false);
  await until(() => editor.evaluate('document.querySelector("[data-offline-status]")?.textContent.includes("Für Offlinebetrieb bereit")'), 'matching cache repaired online');
  await setOffline(editor, true);
  // Close the document entirely, then reopen offline with the same installation/storage.
  await send("Target.closeTarget", { targetId: editor.targetId });
  editor = await page({ persistent: false });
  await setOffline(editor, true);
  await navigate(editor);
  await hydrated(editor);
  await until(() => editor.evaluate('document.body.textContent.includes("Gerätespeicher wird vom Browser verwaltet")'), 'persistent storage refusal handled');
  await editor.evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("DCS-R")).click()');
  await until(() => editor.evaluate('!!document.querySelector("canvas")'), "offline DCS");
  await until(() => editor.evaluate('[...document.querySelectorAll("main img")].every(img => img.complete && img.naturalWidth > 0)'), "DCS image layout");
  await editor.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const rect = await editor.evaluate(`(() => {
    const canvas = document.querySelector('canvas'); canvas.scrollIntoView({ block: 'center' });
    const r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);
  const start = { x: rect.x + rect.width * 0.2, y: rect.y + rect.height * 0.3 };
  const finish = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.6 };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...start, button: "left", buttons: 1, clickCount: 1 }, editor.sessionId);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...finish, button: "left", buttons: 1 }, editor.sessionId);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...finish, button: "left", buttons: 0, clickCount: 1 }, editor.sessionId);
  await until(async () => !!(await editor.snapshot()).sessionData.dcsr.drawingKeys?.[1], "offline drawing saved");
  await editor.evaluate(`(() => {
    const label = [...document.querySelectorAll('div')].find(node => node.textContent === 'Richtig');
    label.parentElement.parentElement.querySelector('button').click();
  })()`);
  await until(async () => (await editor.snapshot()).sessionData.dcsr.counts[1].richtig === 1, "offline scoring saved");
  await editor.click("Übersicht");
  await checkExports(editor);
  console.log("PASS: offline reload, cold reopen, all figure/icon assets, drawing, scoring, and CSV/PDF generation");
  await editor.evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("DCS-R")).click()');
  await until(() => editor.evaluate('!!document.querySelector("canvas")'), "assessment before standalone PDF");
  await checkStandalonePdf(editor, "ios");
  await checkStandalonePdf(editor, "display-mode");
  await checkStandaloneCsv(editor);
  await checkFullBackup(editor);
  await editor.click("Übersicht");
  await editor.click('TMT A und B');
  await until(() => editor.evaluate('!!document.querySelector("main .text-4xl")'), 'timed assessment');
  await editor.click('Start');
  await until(() => editor.evaluate('!!document.querySelector("[data-running-timer=true]")'), 'running stopwatch');
  await editor.click('Backup');
  await editor.click('Backup erstellen');
  await until(() => editor.evaluate('document.getElementById("npt-backup")?.textContent.includes("vor dem Backup beenden")'), 'running measurement backup blocked');
  await editor.click('← Zurück zur Testung');
  await editor.click('Stopp');
  await until(() => editor.evaluate('!document.querySelector("[data-running-timer=true]")'), 'stopwatch saved');
  assert.ok((await editor.snapshot()).sessionData.tmt_a > 0);
  await editor.click('Übersicht');
  console.log("PASS: iOS/standalone PDF stays in-app, prints only the report, and returns to the same assessment offline");
  console.log("PASS: standalone CSV shares/copies exact content, handles cancellation/failure/fallback, and returns without navigation");
  console.log("PASS: complete backup restores sketches, scored figures, data and screen; damaged files and failed writes preserve the current assessment");

  await setOffline(editor, false);
  await editor.evaluate(`window.pwaBoot = 'original'; window.controllerChanges = 0; navigator.serviceWorker.addEventListener('controllerchange', () => window.controllerChanges++);`);
  release = "broken";
  const failedState = await editor.evaluate(`(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const observed = new Promise(resolve => reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(worker.state); });
    }, { once: true }));
    await reg.update(); return observed;
  })()`);
  assert.equal(failedState, "redundant");
  assert.deepEqual(await editor.evaluate('caches.keys()'), staticCache);
  assert.equal(await editor.evaluate('window.controllerChanges'), 0);
  console.log("PASS: incomplete release fails installation and preserves the working offline version");

  release = "updated";
  await editor.click('Nach Updates suchen');
  await until(() => editor.evaluate('navigator.serviceWorker.getRegistration().then(reg => !!reg.waiting)'), "update waiting");
  await until(() => editor.evaluate('document.body.textContent.includes("Eine neue App-Version ist bereit")'), "update status");
  assert.equal(await editor.evaluate('window.pwaBoot'), "original");
  assert.equal(await editor.evaluate('window.controllerChanges'), 0);
  assert.equal(await editor.evaluate('fetch("/index.html").then(r => r.text()).then(html => html.includes("npt-test-release"))'), false);
  // Newer unversioned HTML must not be used to repair an older release's cache.
  await editor.evaluate(`caches.open(${JSON.stringify(staticCache[0])}).then(cache => cache.delete('/index.html'))`);
  await editor.click('Nach Updates suchen');
  await until(() => editor.evaluate('document.body.textContent.includes("Offline-Version nicht verfügbar")'), 'missing old release index detected');
  await editor.click('Erneut herunterladen');
  await until(() => editor.evaluate('document.body.textContent.includes("Offline-Version nicht verfügbar") && !document.querySelector("[data-offline-status]").textContent.includes("geprüft")'), 'newer HTML repair rejected');
  const oldRelease = await editor.evaluate(`new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => { channel.port1.close(); resolve(data); };
    navigator.serviceWorker.controller.postMessage({ type: 'VERIFY_OFFLINE', repair: true }, [channel.port2]);
  })`);
  assert.equal(oldRelease.ready, false);
  assert.ok(oldRelease.missing.includes('/index.html'));
  assert.equal(await editor.evaluate(`caches.open(${JSON.stringify(staticCache[0])}).then(cache => cache.match('/index.html')).then(Boolean)`), false);
  const second = await page();
  await navigate(second);
  await until(() => second.evaluate('document.body?.textContent.includes("Testung bereits geöffnet")'), "second tab locked");
  await send("Target.closeTarget", { targetId: editor.targetId });
  assert.equal(await second.evaluate('navigator.serviceWorker.getRegistration().then(reg => !!reg.waiting)'), true);
  await send("Target.closeTarget", { targetId: second.targetId });
  // Activation can proceed only after both the editor and the waiting tab are closed.
  await delay(300);
  editor = await page();
  await setOffline(editor, true);
  await navigate(editor);
  await hydrated(editor);
  assert.equal(await editor.evaluate('document.querySelector("meta[name=npt-test-release]")?.content'), "updated");
  assert.equal((await editor.snapshot()).sessionData.dcsr.counts[1].richtig, 1);
  assert.equal((await editor.snapshot()).sessionData.demographics.education_years, 11.5);
  assert.deepEqual(await editor.evaluate('caches.keys()'), [`npt-static-${version}-updated`]);
  // Check the drawings store directly; application cache cleanup must never delete it.
  assert.equal(await editor.evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open('npt-db', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const key = JSON.parse(localStorage.npt_session_backup).sessionData.dcsr.drawingGalleryKeys[1][0].key;
      const read = db.transaction('drawings').objectStore('drawings').get(key);
      read.onsuccess = () => { resolve(read.result instanceof Blob && read.result.size > 0); db.close(); };
      read.onerror = () => reject(read.error);
    };
  })`), true);
  assert.deepEqual(browserErrors, []);
  console.log("PASS: updates wait for all windows, activate on next launch offline, and retain session data/drawings");
} finally {
  await send("Target.disposeBrowserContext", { browserContextId });
  socket.close();
  await new Promise(resolve => server.close(resolve));
}
