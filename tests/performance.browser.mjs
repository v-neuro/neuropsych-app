import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Disposable contexts and synthetic records only; never use a patient session.
const appUrl = process.env.NPT_APP_URL || "http://127.0.0.1:5178";
const debugUrl = process.env.NPT_CDP_URL || "http://127.0.0.1:9227";
const endpoint = await (await fetch(`${debugUrl}/json/version`)).json();
const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const requests = new Map();
socket.addEventListener("message", ({ data }) => {
  const result = JSON.parse(data);
  const request = requests.get(result.id);
  if (!request) return;
  requests.delete(result.id);
  clearTimeout(request.timeout);
  if (result.error) request.reject(new Error(JSON.stringify(result.error)));
  else request.resolve(result.result);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
    requests.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function until(check, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(40);
  }
  throw new Error(`Timeout: ${label}`);
}
const contexts = [];
async function page(name, sessionData = {}, timers = []) {
  const { browserContextId } = await send("Target.createBrowserContext");
  contexts.push(browserContextId);
  const { targetId } = await send("Target.createTarget", { browserContextId, url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false }, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (!localStorage.getItem('audit-seeded')) {
      localStorage.setItem('audit-seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      localStorage.setItem('sessionUUID', 'performance-test');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'performance-test', lastUpdated: Date.now(), screen: { name: ${JSON.stringify(name)} },
        globalTimers: ${JSON.stringify(timers)}.map(timer => ({ startTs: Date.now(), ...timer })),
        sessionData: { demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' }, ...${JSON.stringify(sessionData)} }
      }));
    }
    window.audit = { backups: 0, dbOpens: 0, dataUrls: 0, encodes: 0, errors: 0, intervals: {}, callbacks: 0 };
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + (window.clockOffset || 0);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'npt_session_backup') audit.backups++; return setItem.call(this, key, value); };
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => { audit.dbOpens++; return open(...args); };
    const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    window.setInterval = (callback, ms, ...args) => {
      // Vite's development-only websocket heartbeat is not an application timer.
      const developmentClient = new Error().stack?.includes('/@vite/client');
      const id = interval(() => {
        if (!developmentClient && window.pauseClockCallbacks) return;
        if (!developmentClient) audit.callbacks++;
        callback(...args);
      }, ms);
      if (!developmentClient) audit.intervals[id] = ms;
      return id;
    };
    window.clearInterval = id => { delete audit.intervals[id]; clear(id); };
    const dataUrl = HTMLCanvasElement.prototype.toDataURL, blob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toDataURL = function(...args) { audit.dataUrls++; return dataUrl.apply(this, args); };
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      const number = ++audit.encodes;
      return blob.call(this, value => setTimeout(() => callback(value), window.reverseEncodes && number % 2 ? 120 : 0), ...args);
    };
    const error = console.error.bind(console);
    console.error = (...args) => { audit.errors++; error(...args); };
  ` }, sessionId);
  await send("Page.navigate", { url: appUrl }, sessionId);
  await until(() => evaluate('!!document.getElementById("topbar-root")'), `${name} hydration`);
  await delay(500);
  const click = (label) => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)});
    button.click();
  })()`);
  return { sessionId, browserContextId, evaluate, click, snapshot: () => evaluate('JSON.parse(localStorage.npt_session_backup)') };
}
async function quiet(p, label) {
  await delay(450); // Let the legitimate debounced save finish.
  const before = await p.evaluate('({ ...audit })');
  await delay(500);
  const after = await p.evaluate('({ ...audit })');
  assert.equal(after.backups, before.backups, `${label}: repeated backup writes`);
  assert.equal(after.dbOpens, before.dbOpens, `${label}: repeated IDB work`);
  assert.equal(after.errors, 0, `${label}: browser errors`);
}
const fingerprintCode = `canvas => {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let ink = 0, hash = 0;
  for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) ink++; hash = (Math.imul(hash, 31) + pixels[i]) | 0; }
  return { ink, hash };
}`;
const fingerprint = (p) => p.evaluate(`(${fingerprintCode})(document.querySelector('canvas'))`);
async function draw(p, points, touch = false) {
  const rect = await p.evaluate(`(() => {
    const canvas = document.querySelector('canvas'); canvas.scrollIntoView({ block: 'center' });
    const rect = canvas.getBoundingClientRect(); return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  })()`);
  const coords = points.map(([x, y]) => ({ x: rect.x + x * rect.width / 640, y: rect.y + y * rect.height / 180 }));
  for (let i = 0; i < coords.length; i++) {
    if (touch) await send("Input.dispatchTouchEvent", { type: i === 0 ? "touchStart" : "touchMove", touchPoints: [{ ...coords[i], id: 1 }] }, p.sessionId);
    else await send("Input.dispatchMouseEvent", { type: i === 0 ? "mousePressed" : "mouseMoved", ...coords[i], button: "left", buttons: 1, clickCount: 1 }, p.sessionId);
  }
  if (touch) await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, p.sessionId);
  else await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...coords.at(-1), button: "left", buttons: 0, clickCount: 1 }, p.sessionId);
}
const storedFingerprint = (p, gallery = false) => p.evaluate(`(async () => {
  const state = JSON.parse(localStorage.npt_session_backup).sessionData.dcsr;
  const key = ${gallery ? 'state.drawingGalleryKeys[0].at(-1).key' : 'state.drawingKeys[0]'};
  if (!key) return null;
  const blob = await new Promise((resolve, reject) => {
    const request = indexedDB.open('npt-db', 2);
    request.onsuccess = () => { const db = request.result; const get = db.transaction('drawings').objectStore('drawings').get(key); get.onsuccess = () => { resolve(get.result); db.close(); }; get.onerror = () => reject(get.error); };
    request.onerror = () => reject(request.error);
  });
  if (!blob) return null;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
  return (${fingerprintCode})(canvas);
})()`);

try {
  for (const name of ['vlmt', 'dcsr', 'zahl_fwd', 'zahl_rev', 'block_fwd', 'block_rev']) {
    const p = await page(name, name === 'vlmt' ? { vlmt: { step: 'score', list: 'A', dg: 1 } } : {});
    if (name === 'vlmt') {
      await p.click('Trommel');
      assert.equal((await p.snapshot()).sessionData.vlmt.results[0].sel.Trommel, true);
    } else if (name !== 'dcsr') {
      await p.evaluate('document.querySelector("button[data-testid$=v1-ok]").click()');
      assert.equal((await p.snapshot()).sessionData[name].vals[0].v1, 1);
    }
    await quiet(p, name);
    await send('Target.disposeBrowserContext', { browserContextId: p.browserContextId });
    contexts.splice(contexts.indexOf(p.browserContextId), 1);
  }
  console.log('PASS: VLMT, DCS-R and all four span screens stop saving at idle; real edits still persist.');

  const epi = await page('epi');
  assert.deepEqual(await epi.evaluate('Object.values(audit.intervals)'), []);
  await epi.evaluate('document.querySelectorAll("main .text-4xl")[0].parentElement.querySelector("button").click()');
  assert.deepEqual(await epi.evaluate('Object.values(audit.intervals)'), [50]);
  await delay(150);
  await epi.evaluate('document.querySelectorAll("main .text-4xl")[0].parentElement.querySelector("button").click()');
  assert.ok((await epi.snapshot()).sessionData.epi.times.zahlen_interferenz > 0);
  assert.deepEqual(await epi.evaluate('Object.values(audit.intervals)'), []);
  // Jump the synthetic clock, not callback counts: expiration must catch up even
  // when no scheduled callback has run. No real device/browser clock is changed.
  await epi.evaluate('window.pauseClockCallbacks = true; document.querySelectorAll("main .text-4xl")[4].parentElement.querySelector("button").click()');
  await epi.evaluate('window.clockOffset = 61000; document.dispatchEvent(new Event("visibilitychange"))');
  await until(() => epi.evaluate('document.querySelectorAll("main .text-4xl")[4].textContent === "0:00.00"'), 'countdown completes');
  assert.deepEqual(await epi.evaluate('Object.values(audit.intervals)'), []);
  await quiet(epi, 'idle/completed EpiTrack timers');

  const clocks = await page('epi');
  const timerButton = (index, button = 0) => clocks.evaluate(`document.querySelectorAll('main .text-4xl')[${index}].parentElement.querySelectorAll('button')[${button}].click()`);
  const timerMs = (index) => clocks.evaluate(`(() => {
    const [minutes, seconds] = document.querySelectorAll('main .text-4xl')[${index}].textContent.split(':');
    return Number(minutes) * 60000 + Number(seconds) * 1000;
  })()`);
  await clocks.evaluate(`window.pauseClockCallbacks = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.auditVisibility || 'visible' });`);
  await timerButton(4);
  await delay(40);
  await clocks.evaluate('window.clockOffset = 7500');
  await timerButton(4); // Pause before any scheduled refresh has run.
  const paused = await timerMs(4);
  assert.ok(paused <= 52500 && paused > 52000, `Pause uses click time: ${paused}`);
  await clocks.evaluate('window.clockOffset = 107500; window.dispatchEvent(new Event("focus"))');
  assert.equal(await timerMs(4), paused, 'Paused time is excluded');
  await timerButton(4);
  await delay(40);
  await clocks.evaluate('window.clockOffset = 110000; window.dispatchEvent(new Event("pageshow"))');
  const resumed = await timerMs(4);
  assert.ok(resumed < paused - 2500 && resumed > paused - 3000, `Resume keeps remaining time: ${resumed}`);
  await timerButton(4, 1);
  await clocks.click('Zurücksetzen');
  assert.equal(await timerMs(4), 60000);
  assert.deepEqual(await clocks.evaluate('Object.values(audit.intervals)'), []);
  await clocks.evaluate('window.clockOffset = 200000; window.dispatchEvent(new Event("focus"))');
  assert.equal(await timerMs(4), 60000, 'Reset cannot be overwritten by an old deadline');
  await timerButton(4);
  await delay(40);
  await clocks.evaluate('window.auditVisibility = "hidden"; document.dispatchEvent(new Event("visibilitychange"))');
  assert.deepEqual(await clocks.evaluate('Object.values(audit.intervals)'), [], 'Hidden clocks do not poll');
  await clocks.evaluate('window.clockOffset = 270000; window.auditVisibility = "visible"; document.dispatchEvent(new Event("visibilitychange"))');
  await until(async () => await timerMs(4) === 0, 'visibility restores correct expired countdown');

  await timerButton(0);
  await delay(40);
  await clocks.evaluate('window.clockOffset = 280000');
  await timerButton(0);
  const measured = (await clocks.snapshot()).sessionData.epi.times.zahlen_interferenz;
  assert.ok(measured >= 10000 && measured < 10500, 'Stopwatch stop samples real elapsed time without ticks');
  await clocks.evaluate('window.clockOffset = 380000');
  await timerButton(0);
  await delay(40);
  await clocks.evaluate('window.clockOffset = 382000');
  await timerButton(0);
  const accumulated = (await clocks.snapshot()).sessionData.epi.times.zahlen_interferenz;
  assert.ok(accumulated >= measured + 2000 && accumulated < measured + 2500, 'Stopwatch resumes but excludes paused time');

  for (const [index, subtest, limit, offset] of [
    [1, 'zahlen_verbinden', 180000, 582000],
    [2, 'zahlen_buchstaben', 300000, 902000],
  ]) {
    await timerButton(index);
    await delay(40);
    await clocks.evaluate(`window.clockOffset = ${offset}`);
    await timerButton(index); // Stop after the limit before any timer callback.
    const state = (await clocks.snapshot()).sessionData;
    assert.equal(state.epi.times[subtest], limit, 'Over-limit stop is capped');
    assert.equal(state.epi_aborted[subtest].limit_ms, limit, 'Over-limit stop records automatic abort');
    const backups = await clocks.evaluate('audit.backups');
    await clocks.evaluate('window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("pageshow"))');
    assert.equal(await clocks.evaluate('audit.backups'), backups, 'Automatic abort fires only once');
  }
  assert.deepEqual(await clocks.evaluate('Object.values(audit.intervals)'), []);
  await quiet(clocks, 'delayed clocks');
  console.log('PASS: delayed countdown/stopwatch updates, click-time pause/stop, resume, reset, hidden-page catch-up and both time limits without scheduled ticks.');

  const tmt = await page('tmt_ab');
  await tmt.evaluate(`window.pauseClockCallbacks = true;
    document.querySelectorAll('main .text-4xl')[0].parentElement.querySelector('button').click();
    document.querySelectorAll('main .text-4xl')[1].parentElement.querySelector('button').click();`);
  await delay(40);
  await tmt.evaluate('window.clockOffset = 310000');
  await tmt.click('Fertig'); // Imperative stop during navigation must enforce both limits.
  const tmtState = (await tmt.snapshot()).sessionData;
  assert.equal(tmtState.tmt_a, 180000);
  assert.equal(tmtState.tmt_b, 300000);
  assert.equal(tmtState.tmt_a_aborted.limit_ms, 180000);
  assert.equal(tmtState.tmt_b_aborted.limit_ms, 300000);
  assert.deepEqual(await tmt.evaluate('Object.values(audit.intervals)'), []);

  const autoLimit = await page('epi');
  await autoLimit.evaluate(`window.pauseClockCallbacks = true;
    document.querySelectorAll('main .text-4xl')[1].parentElement.querySelector('button').click();`);
  await delay(40);
  await autoLimit.evaluate('window.clockOffset = 190000; window.pauseClockCallbacks = false');
  await until(async () => (await autoLimit.snapshot()).sessionData.epi_aborted?.zahlen_verbinden?.limit_ms === 180000, 'late callback enforces stopwatch limit');
  assert.equal((await autoLimit.snapshot()).sessionData.epi.times.zahlen_verbinden, 180000);
  assert.deepEqual(await autoLimit.evaluate('Object.values(audit.intervals)'), []);
  await quiet(autoLimit, 'late automatic abort');
  console.log('PASS: late scheduled auto-abort and programmatic stop on Fertig enforce limits and preserve abort markers.');

  const reminder = await page('menu', {}, [
    { id: 'active', label: 'Active', durationMs: 1200, nav: { name: 'vlmt' } },
    { id: 'complete', label: 'Complete', startTs: 1, durationMs: 1 },
    { id: 'untimed', label: 'Untimed', untimed: true, nav: { name: 'dcsr' } },
  ]);
  assert.deepEqual(await reminder.evaluate('Object.values(audit.intervals)'), [1000]);
  await until(() => reminder.evaluate('Object.values(audit.intervals).length === 0'), 'reminder expires');
  const calls = await reminder.evaluate('audit.callbacks');
  await delay(500);
  assert.equal(await reminder.evaluate('audit.callbacks'), calls);
  const delayedReminder = await page('menu', {}, [
    { id: 'delayed', label: 'Delayed', durationMs: 600000, nav: { name: 'vlmt' } },
  ]);
  await delayedReminder.evaluate('window.pauseClockCallbacks = true; window.clockOffset = 610000; window.dispatchEvent(new Event("pageshow"))');
  await until(() => delayedReminder.evaluate('Object.values(audit.intervals).length === 0'), 'delayed reminder expires on return');
  console.log('PASS: idle/stopped/completed stopwatches, countdowns and reminders release their intervals.');

  const saving = await page('qolie31');
  const before = await saving.evaluate('audit.backups');
  await saving.evaluate('document.querySelector(\'input[name="qolie-item-1"][value="0"]\').click()');
  assert.equal((await saving.snapshot()).sessionData.qolie31.responses[1], 0);
  assert.equal(await saving.evaluate('audit.backups'), before + 1);
  await delay(450);
  await saving.evaluate('window.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("beforeunload"))');
  assert.equal(await saving.evaluate('audit.backups'), before + 1);
  await quiet(saving, 'duplicate lifecycle saves');
  console.log('PASS: immediate zero-answer backup is retained without duplicate debounce/lifecycle backup writes.');

  const drawing = await page('dcsr', { dcsr: { step: 'dg', ver: 'V1', dg: 1 } });
  await until(() => drawing.evaluate('!!document.querySelector("canvas")'), 'drawing canvas');
  assert.equal((await fingerprint(drawing)).ink, 0);
  await draw(drawing, [[25, 30], [100, 30]]);
  const first = await fingerprint(drawing);
  assert.ok(first.ink > 0);
  await until(async () => (await storedFingerprint(drawing))?.hash === first.hash, 'first stroke saved');
  await draw(drawing, [[130, 30], [130, 100]]);
  assert.ok((await fingerprint(drawing)).ink > first.ink);
  await drawing.click('Rückgängig');
  assert.deepEqual(await fingerprint(drawing), first);
  await until(async () => (await storedFingerprint(drawing))?.hash === first.hash, 'undo saved');
  await drawing.click('Rückgängig');
  assert.equal((await fingerprint(drawing)).ink, 0);
  await until(async () => await storedFingerprint(drawing) === null, 'undo to blank deletes the drawing');
  await drawing.evaluate('window.reverseEncodes = true');
  await draw(drawing, [[25, 50], [100, 50]]);
  await draw(drawing, [[140, 30], [140, 100]]);
  const latest = await fingerprint(drawing);
  await until(async () => (await storedFingerprint(drawing))?.hash === latest.hash, 'latest drawing wins out-of-order encodes');
  await delay(200);
  assert.deepEqual(await storedFingerprint(drawing), latest);
  await drawing.click('Übersicht');
  await drawing.evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("DCS-R")).click()');
  await until(async () => (await fingerprint(drawing))?.hash === latest.hash, 'reopened drawing restored');
  await draw(drawing, [[180, 30], [180, 100]], true);
  assert.ok((await fingerprint(drawing)).ink > latest.ink);
  await drawing.click('Rückgängig');
  assert.deepEqual(await fingerprint(drawing), latest); // Undo retains the reopened raster base.
  await quiet(drawing, 'drawing screen');
  await drawing.click('Figur ohne Bewertung speichern');
  await until(async () => (await drawing.snapshot()).sessionData.dcsr.drawingGalleryKeys[0].length === 1 && (await fingerprint(drawing)).ink === 0, 'gallery save clears canvas');
  assert.deepEqual(await storedFingerprint(drawing, true), latest);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, drawing.sessionId);
  await delay(100);
  await draw(drawing, [[300, 80], [400, 80]], true);
  assert.equal(await drawing.evaluate('document.querySelector("canvas").getContext("2d").getImageData(700,160,1,1).data[3] > 0'), true);
  await until(() => drawing.evaluate('[...document.querySelectorAll("button")].find(node => node.textContent === "Figur ohne Bewertung speichern").disabled === false'), 'mobile stroke encoded');
  await drawing.evaluate('[...document.querySelectorAll("button")].find(node => node.textContent === "+1" && node.closest("div.rounded-xl")?.textContent.startsWith("Richtig")).click()');
  await until(async () => (await drawing.snapshot()).sessionData.dcsr.counts[0].richtig === 1 && (await fingerprint(drawing)).ink === 0, 'scored drawing saved');
  assert.equal((await drawing.snapshot()).sessionData.dcsr.drawingGalleryKeys[0].at(-1).rating, 'R');
  assert.equal(await drawing.evaluate('audit.dataUrls'), 0);
  await quiet(drawing, 'saved drawing gallery');
  console.log('PASS: stroke undo, undo-to-blank, async encode ordering, reopened base, touch, mobile coordinates and unscored/scored galleries; zero synchronous PNG snapshots.');
  for (const p of [epi, clocks, tmt, autoLimit, reminder, delayedReminder, saving, drawing]) assert.equal(await p.evaluate('audit.errors'), 0);
} finally {
  for (const browserContextId of contexts) await send('Target.disposeBrowserContext', { browserContextId });
  socket.close();
}
