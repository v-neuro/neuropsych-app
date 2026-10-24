import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const appUrl = process.env.NPT_APP_URL || 'http://127.0.0.1:5178';
const debugUrl = process.env.NPT_CDP_URL || 'http://127.0.0.1:9227';
const { webSocketDebuggerUrl } = await (await fetch(`${debugUrl}/json/version`)).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id); clearTimeout(request.timeout);
  if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const { browserContextId } = await send('Target.createBrowserContext');
const moduleName = `npt-hmr-${process.pid}.js`;
const modulePath = new URL(`../src/lib/${moduleName}`, import.meta.url);
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error(`Timeout: ${label}`);
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)}) {
      localStorage.setItem('auth_ok', 'true'); localStorage.setItem('sessionUUID', 'dev-smoke');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({ sessionUUID: 'dev-smoke', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [], sessionData: { demographics_saved: true, demographics: { patient_initials: 'TEST' } } }));
    }
  ` }, sessionId);
  await send('Page.navigate', { url: appUrl }, sessionId);
  await until('!!document.querySelector(".tile-btn:not(:disabled)")', 'React development app');
  const before = await evaluate('JSON.parse(localStorage.npt_session_backup).sessionData');
  const source = marker => `export const marker = ${JSON.stringify(marker)}; globalThis.nptHmrValue = marker; if (import.meta.hot) import.meta.hot.accept(next => { globalThis.nptHmrValue = next.marker; });\n`;
  await writeFile(modulePath, source('before'), { flag: 'wx' });
  await evaluate(`import('/src/lib/${moduleName}').then(() => { globalThis.nptDocumentSentinel = 'same-document'; })`);
  await until('globalThis.nptHmrValue === "before"', 'initial development module');
  await writeFile(modulePath, source('after'));
  await until('globalThis.nptHmrValue === "after"', 'hot module replacement');
  assert.equal(await evaluate('globalThis.nptDocumentSentinel'), 'same-document');
  assert.deepEqual(await evaluate('JSON.parse(localStorage.npt_session_backup).sessionData'), before);
  console.log('PASS: React development app and real HMR preserve the document and assessment.');
  for (const [name, width, height, mobile] of [['desktop', 1280, 900, false], ['ipad', 820, 1180, true]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    await evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${name}: horizontal overflow`);
    const tile = await evaluate('(() => { const tile = document.querySelector(".tile-btn"); const style = getComputedStyle(tile), rect = tile.getBoundingClientRect(); return { width: rect.width, height: rect.height, radius: parseFloat(style.borderRadius) }; })()');
    assert.ok(tile.width >= 44 && tile.height >= 44 && tile.radius > 0, `${name}: styled touch controls`);
    if (process.env.NPT_SCREENSHOT_DIR) {
      await mkdir(process.env.NPT_SCREENSHOT_DIR, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      await writeFile(`${process.env.NPT_SCREENSHOT_DIR}/${name}.png`, Buffer.from(data, 'base64'));
    }
  }
  console.log('PASS: desktop and iPad viewport retain styled touch controls without horizontal overflow.');
} finally {
  await rm(modulePath, { force: true });
  await send('Target.disposeBrowserContext', { browserContextId });
  socket.close();
}
