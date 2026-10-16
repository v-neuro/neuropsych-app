import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";

// Run npm run build first. This server simulates offline operation and two deployments.
const files = new Map();
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(`${directory}/${entry.name}`, `${relative}/`);
    else files.set(`/${relative}`, await readFile(`${directory}/${entry.name}`));
  }
}
await collect(new URL("../dist", import.meta.url).pathname);
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
  let content = files.get(file);
  if (!content) { response.writeHead(404).end(); return; }
  if (file === "/sw.js" && release !== "initial") content = worker.replace(version, `${version}-${release}`);
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
async function page() {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Page.bringToFront", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
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

try {
  release = "broken";
  let editor = await page();
  await navigate(editor);
  await hydrated(editor);
  await until(() => editor.evaluate('document.body.textContent.includes("Offline-Version nicht verfügbar")'), "failed initial download");
  assert.deepEqual(await editor.evaluate('caches.keys()'), []);
  release = "initial";
  await editor.click("Erneut herunterladen");
  await until(() => editor.evaluate('!!navigator.serviceWorker.controller && document.body.textContent.includes("Für Offlinebetrieb bereit")'), "retry initial download");
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
  // Close the document entirely, then reopen offline with the same installation/storage.
  await send("Target.closeTarget", { targetId: editor.targetId });
  editor = await page();
  await setOffline(editor, true);
  await navigate(editor);
  await hydrated(editor);
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
  await editor.evaluate('navigator.serviceWorker.getRegistration().then(reg => reg.update())');
  await until(() => editor.evaluate('navigator.serviceWorker.getRegistration().then(reg => !!reg.waiting)'), "update waiting");
  await until(() => editor.evaluate('document.body.textContent.includes("Eine neue App-Version ist bereit")'), "update status");
  assert.equal(await editor.evaluate('window.pwaBoot'), "original");
  assert.equal(await editor.evaluate('window.controllerChanges'), 0);
  assert.equal(await editor.evaluate('fetch("/index.html").then(r => r.text()).then(html => html.includes("npt-test-release"))'), false);
  const second = await page();
  await navigate(second);
  await until(() => second.evaluate('document.body.textContent.includes("Testung bereits geöffnet")'), "second tab locked");
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
