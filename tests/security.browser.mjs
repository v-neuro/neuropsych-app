import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

// Synthetic data only, served from this build on an ephemeral loopback port.
const files = new Map();
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) await collect(new URL(`${entry.name}/`, directory), `${name}/`);
    else files.set(`/${name}`, await readFile(new URL(entry.name, directory)));
  }
}
await collect(new URL('../dist/', import.meta.url));
assert.ok(![...files.keys()].some(name => /\.DS_Store|\.env|\.map$|backup\.json/.test(name)));
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const name = path === '/' ? '/index.html' : path;
  const file = files.get(name);
  if (!file) { response.writeHead(404).end(); return; }
  const ext = name.split('.').at(-1);
  const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' }[ext];
  response.writeHead(200, { 'Content-Type': mime || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(file);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const appUrl = `http://127.0.0.1:${server.address().port}`;
let socket;
let browserContextId;
let sequence = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function until(check, label) {
  for (let i = 0; i < 200; i++) { if (await check()) return; await delay(50); }
  throw new Error(`Timeout: ${label}`);
}
try {
  const debugUrl = process.env.NPT_CDP_URL || 'http://127.0.0.1:9227';
  const { webSocketDebuggerUrl } = await (await fetch(`${debugUrl}/json/version`)).json();
  socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  ({ browserContextId } = await send('Target.createBrowserContext'));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const click = label => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Unavailable: ' + ${JSON.stringify(label)});
    button.click();
  })()`);
  await send('Page.navigate', { url: appUrl }, sessionId);
  await until(() => evaluate('!!document.querySelector("input[type=password]")'), 'initial access gate');
  await evaluate(`(() => {
    localStorage.setItem('auth_ok', 'true');
    localStorage.setItem('sessionUUID', 'security-regression');
    const now = new Date();
    localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'));
    localStorage.setItem('npt_session_backup', JSON.stringify({ sessionUUID: 'security-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
      sessionData: { demographics_saved: true, demographics: { patient_initials: 'TEST' }, tmt_a_note: '=1+1',
        dcsr: { ver: 'V1', dg: 1, counts: [{ richtig: 0 }], drawingKeys: ['security-regression:dcsr:main'], drawingGalleryKeys: [[{ key: 'security-regression:dcsr:fig', rating: 'R' }]] } } }));
  })()`);
  await send('Page.reload', {}, sessionId);
  await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), 'app hydration');
  console.log('CONFIRMED OPEN: the browser access gate can be bypassed with localStorage; hosting/device access control is required.');
  await evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open('npt-db', 2);
    open.onsuccess = () => {
      const tx = open.result.transaction('drawings', 'readwrite');
      tx.objectStore('drawings').put('data:image/png;base64,AP+A," onerror="opener.securityXss=true', 'security-regression:dcsr:main');
      tx.objectStore('drawings').put('https://example.invalid/leak', 'security-regression:dcsr:fig');
      tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  })`);
  await evaluate(`(() => {
    window.securityViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.securityViolations.push(event.violatedDirective));
    const script = document.createElement('script'); script.textContent = 'window.securityXss=true'; document.body.append(script);
  })()`);
  await until(() => evaluate('window.securityViolations.includes("script-src-elem")'), 'CSP blocks inline script');
  assert.equal(await evaluate('window.securityXss === undefined'), true);
  console.log('PASS: production CSP blocks injected inline JavaScript.');
  await evaluate(`(() => {
    const original = URL.createObjectURL;
    window.securityOpen = window.open.bind(window);
    URL.createObjectURL = blob => { if (blob.type.startsWith('text/csv')) window.securityCsv = blob.text(); return original(blob); };
    HTMLAnchorElement.prototype.click = function() {};
    window.open = () => ({ document: { write: html => { window.securityPdf = html; }, close() {}, open() {} } });
  })()`);
  await click('CSV Export');
  await until(() => evaluate('!!window.securityCsv'), 'CSV export');
  const csv = await evaluate('window.securityCsv');
  assert.ok(csv.includes('"\'=1+1"'));
  const [headers, values] = csv.split('\n').map(line => line.split(';'));
  assert.equal(values[headers.indexOf('dcsr_dg1_hits')], '"0"');
  await click('PDF Export');
  await until(() => evaluate('window.securityPdf?.includes("Messwerte")'), 'PDF export');
  const pdf = await evaluate('window.securityPdf');
  assert.ok(!pdf.includes('onerror='));
  assert.ok(!pdf.includes('example.invalid'));
  assert.ok(!pdf.includes('<script>'));
  console.log('PASS: real CSV export escapes formula input and preserves zero; PDF ignores unsafe persisted drawing URLs.');
  await evaluate(`(() => {
    window.securityPrints = 0;
    window.open = (...args) => {
      const popup = window.securityOpen(...args); window.securityPopup = popup;
      if (popup) popup.print = () => { window.securityPrints++; };
      return popup;
    };
  })()`);
  await click('PDF Export');
  await until(() => evaluate('!!window.securityPopup?.document.querySelector("#npt-print")'), 'real PDF popup');
  assert.equal(await evaluate('window.securityPopup.document.querySelectorAll("script,[onclick],[onerror]").length'), 0);
  const printCount = await evaluate('window.securityPrints');
  await evaluate('window.securityPopup.document.querySelector("#npt-print").click()');
  assert.ok(await evaluate('window.securityPrints') > printCount);
  await evaluate('window.securityPopup.close()');
  console.log('PASS: the real PDF popup renders under CSP and its print button works without inline JavaScript.');
  await click('Backup');
  await until(() => evaluate('!!document.querySelector("dialog[open]")'), 'backup menu');
  await click('Backup laden');
  const snapshotBefore = await evaluate('localStorage.getItem("npt_session_backup")');
  await evaluate(`(async () => {
    const payload = { format: 'digitale-npt-assessment', schemaVersion: 1, createdAt: new Date().toISOString(), appVersion: 'security-test',
      snapshot: { sessionUUID: 'security-import', screen: { name: 'menu' }, globalTimers: [], sessionData: {} },
      drawings: [{ key: 'security-import:dcsr:fig', kind: 'string', data: 'data:image/png;base64,AP+A," onerror="window.securityXss=true' }] };
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const checksum = [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2,'0')).join('');
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({ ...payload, checksum })], 'synthetic.npt-backup.json', { type: 'application/json' }));
    const input = document.querySelector('input[type=file]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await until(() => evaluate('document.body.textContent.includes("Ungültige Zeichnung")'), 'malicious backup rejected');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Backup wiederherstellen").disabled'), true);
  assert.equal(await evaluate('localStorage.getItem("npt_session_backup")'), snapshotBefore);
  assert.equal(await evaluate('window.securityXss === undefined'), true);
  console.log('PASS: a malicious backup with a recomputed checksum cannot be restored; existing assessment remains intact.');
} finally {
  if (socket?.readyState === WebSocket.OPEN && browserContextId) await send('Target.disposeBrowserContext', { browserContextId });
  socket?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
