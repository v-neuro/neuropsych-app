import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Uses a fresh browser context: existing browser sessions and patient data are untouched.
// Start Vite and a Chromium browser with remote debugging before running this script.
const appUrl = process.env.NPT_APP_URL || "http://127.0.0.1:5178";
const debugUrl = process.env.NPT_CDP_URL || "http://127.0.0.1:9227";
const { webSocketDebuggerUrl } = await (await fetch(`${debugUrl}/json/version`)).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails);
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
async function evaluate(page, expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, page.sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(check, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
const snapshot = (page) => evaluate(page, 'JSON.parse(localStorage.getItem("npt_session_backup"))');
const isEditor = (page) => evaluate(page, '!!document.getElementById("topbar-root")');
const isBlocked = (page) => evaluate(page, '!!document.body?.textContent.includes("Testung bereits geöffnet")');
async function assertNoWrites(page, before) {
  const after = await snapshot(page);
  // Focusing a different tab can legitimately trigger the owner's visibility flush.
  assert.deepEqual({ ...after, lastUpdated: before.lastUpdated }, before);
  assert.deepEqual(await evaluate(page, "globalThis.storageWrites"), []);
}
const click = (page, label) => evaluate(page, `(() => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
  if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(label)});
  button.click();
})()`);

const { browserContextId } = await send("Target.createBrowserContext");
const openedPages = [];
async function createPage(extraScript = "") {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = { targetId, sessionId };
  openedPages.push(page);
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('npt_regression_seeded')) {
      localStorage.setItem('npt_regression_seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      localStorage.setItem('sessionUUID', 'regression-session');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'regression-session', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
        sessionData: { demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' } }
      }));
    }
    globalThis.storageWrites = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      globalThis.storageWrites.push(key);
      return originalSetItem.call(this, key, value);
    };
    ${extraScript}
  ` }, sessionId);
  return page;
}
const navigate = (page, url = appUrl) => send("Page.navigate", { url }, page.sessionId);

try {
  const pages = await Promise.all([createPage(), createPage()]);
  await Promise.all(pages.map(page => navigate(page)));
  await until(async () => (await Promise.all(pages.map(isEditor))).filter(Boolean).length === 1 && (await Promise.all(pages.map(isBlocked))).filter(Boolean).length === 1, "exactly one editor");
  const owner = await isEditor(pages[0]) ? pages[0] : pages[1];
  const waiting = owner === pages[0] ? pages[1] : pages[0];
  await until(async () => (await snapshot(owner))?.sessionData?.demographics_saved, "fixture hydration");
  await delay(400);

  // A waiting tab must not run App's pruning effects or touch its backup.
  await evaluate(owner, `new Promise((resolve, reject) => {
    const request = indexedDB.open('npt-db', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('drawings', 'readwrite');
      tx.objectStore('drawings').put(new Blob(['test drawing']), 'other-session:dcsr:dg1');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await send("Page.bringToFront", {}, waiting.sessionId);
  const beforeWaiting = await snapshot(owner);
  await click(waiting, "Erneut versuchen");
  await until(() => isBlocked(waiting), "retry while owner remains open");
  await delay(400);
  await assertNoWrites(waiting, beforeWaiting);
  assert.equal(await evaluate(waiting, `new Promise((resolve, reject) => {
    const request = indexedDB.open('npt-db', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('drawings').objectStore('drawings').get('other-session:dcsr:dg1');
      get.onsuccess = () => { db.close(); resolve(!!get.result); };
      get.onerror = () => reject(get.error);
    };
  })`), true);
  console.log("PASS: simultaneous tabs, blocked retry, background ownership, and no backup/drawing writes from waiting tab.");

  await click(owner, "Grooved Pegboard");
  await until(() => evaluate(owner, '!![...document.querySelectorAll("button")].find(node => node.textContent.trim() === "Start")'), "GP timers");
  await click(owner, "Start");
  await delay(250);
  await click(owner, "Testabbruch");
  await evaluate(owner, `(() => {
    const select = document.querySelector('select');
    select.value = 'Technisches Problem';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const note = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Browser regression abort');
    note.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(owner, "Beenden");
  await until(async () => (await snapshot(owner))?.sessionData?.gp_aborted, "persisted abort");
  const aborted = await snapshot(owner);
  assert.equal(aborted.screen.name, "menu");
  assert.equal(aborted.sessionData.gp_aborted.reason, "Technisches Problem");
  assert.equal(aborted.sessionData.gp_aborted.note, "Browser regression abort");
  assert.ok(aborted.sessionData.gp_aborted.at > 0);
  assert.ok(aborted.sessionData.gp.dom_ms > 0);
  assert.equal(aborted.sessionData.gp.non_ms, undefined);
  await delay(400);
  assert.equal((await snapshot(owner)).sessionData.gp.dom_ms, aborted.sessionData.gp.dom_ms);
  assert.equal(await evaluate(owner, '[...document.querySelectorAll("button")].some(node => node.textContent.includes("Grooved Pegboard") && node.textContent.includes("abgebrochen"))'), true);
  await evaluate(owner, `(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { globalThis.exportedCsv = blob.text(); return original(blob); };
  })()`);
  await click(owner, "CSV Export");
  const csv = await evaluate(owner, "globalThis.exportedCsv");
  const [headers, values] = csv.split("\n").map(line => line.split(";"));
  assert.equal(values[headers.indexOf("gp_aborted")], '"1"');
  console.log("PASS: GP abort stops the running timer, leaves untouched timer empty, saves reason/note, updates menu and CSV.");

  await send("Page.reload", {}, owner.sessionId);
  await until(async () => await isEditor(owner) && (await snapshot(owner))?.sessionData?.gp_aborted?.note === "Browser regression abort", "owner reload");
  await click(waiting, "Erneut versuchen");
  await until(() => isBlocked(waiting), "ownership after reload");
  await send("Target.closeTarget", { targetId: owner.targetId });
  await click(waiting, "Erneut versuchen");
  await until(() => isEditor(waiting), "handoff after close");
  await until(async () => (await snapshot(waiting))?.sessionData?.gp_aborted?.note === "Browser regression abort", "handoff hydration");
  assert.equal((await snapshot(waiting)).sessionData.gp.dom_ms, aborted.sessionData.gp.dom_ms);
  console.log("PASS: reload and close/retry handoff restore the latest saved record.");

  await evaluate(waiting, "window.confirm = () => true");
  await click(waiting, "Neue Testung");
  await until(async () => (await snapshot(waiting)).sessionUUID !== "regression-session", "new session");
  const newSession = (await snapshot(waiting)).sessionUUID;
  const next = await createPage();
  await navigate(next);
  await until(() => isBlocked(next), "new tab blocked after session reset");
  await send("Target.closeTarget", { targetId: waiting.targetId });
  await click(next, "Erneut versuchen");
  await until(() => isEditor(next), "new session handoff");
  await delay(400);
  const restored = await snapshot(next);
  assert.equal(restored.sessionUUID, newSession);
  assert.equal(restored.sessionData.gp_aborted, undefined);
  assert.equal(restored.sessionData.gp, undefined);
  console.log("PASS: starting a new session retains ownership and handoff never revives the old patient's data.");

  // A history-cached document can retain its lock. Whether cached or reloaded,
  // returning through history must never produce two editors.
  const history = await send("Page.getNavigationHistory", {}, next.sessionId);
  const appEntry = history.entries[history.currentIndex].id;
  const backWaiting = await createPage();
  await navigate(backWaiting);
  await until(() => isBlocked(backWaiting), "history test waiting tab");
  await navigate(next, "about:blank");
  // Cross-site navigation can leave the old CDP session attached to the cached
  // renderer; attach to the active page before issuing history commands.
  await delay(100);
  const activePage = await send("Target.attachToTarget", { targetId: next.targetId, flatten: true });
  next.sessionId = activePage.sessionId;
  await send("Page.enable", {}, next.sessionId);
  await click(backWaiting, "Erneut versuchen");
  await until(async () => await isEditor(backWaiting) || await isBlocked(backWaiting), "ownership after navigating away");
  const ownershipTransferred = await isEditor(backWaiting);
  await send("Page.navigateToHistoryEntry", { entryId: appEntry }, next.sessionId);
  await until(() => ownershipTransferred ? isBlocked(next) : isEditor(next), "history return obeys current ownership");
  assert.equal(Number(await isEditor(next)) + Number(await isEditor(backWaiting)), 1);
  console.log("PASS: browser navigation and history return respect current ownership.");

  for (const [script, message] of [
    ["Object.defineProperty(navigator, 'locks', { value: undefined });", "HTTPS-Verbindung"],
    ["Object.defineProperty(navigator, 'locks', { value: { request: () => Promise.reject(new Error('Simulated denial')) } });", "nicht zum Bearbeiten freigegeben"],
  ]) {
    const before = await snapshot(backWaiting);
    const unsupported = await createPage(script);
    await navigate(unsupported);
    await until(() => evaluate(unsupported, `!!document.body?.textContent.includes(${JSON.stringify(message)})`), "unavailable lock message");
    assert.equal(await isEditor(unsupported), false);
    await assertNoWrites(unsupported, before);
  }
  console.log("PASS: missing or rejected lock API never mounts the editing app or changes the backup.");
} catch (error) {
  console.error("Browser exceptions:", JSON.stringify(browserErrors));
  for (const page of openedPages) {
    try {
      console.error("Page:", await evaluate(page, '({ url: location.href, text: document.body?.innerText?.slice(0, 1500) })'));
    } catch {
      // Pages already closed by a passing handoff check are unavailable.
    }
  }
  throw error;
} finally {
  await send("Target.disposeBrowserContext", { browserContextId });
  socket.close();
}
