import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Uses an isolated browser context with synthetic data.
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

const scenarios = [
  { name: "not performed", dcsr: undefined, expected: "" },
  { name: "advance without points", dcsr: undefined, advance: true, expected: '"0"' },
  { name: "saved progression without version", dcsr: { step: "dg", dg: 2 }, expected: '"0"' },
  { name: "saved awarded points", dcsr: { step: "dg", dg: 2, ver: "V1", counts: [{ richtig: 3 }] }, expected: '"3"' },
];

try {
  for (const scenario of scenarios) {
    const { browserContextId } = await send("Target.createBrowserContext");
    try {
      const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
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
      const snapshot = () => evaluate('JSON.parse(localStorage.getItem("npt_session_backup"))');
      await send("Page.enable", {}, sessionId);
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `
        if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('dcsr_fixture_seeded')) {
          localStorage.setItem('dcsr_fixture_seeded', 'true');
          localStorage.setItem('auth_ok', 'true');
          localStorage.setItem('sessionUUID', 'dcsr-regression');
          const now = new Date();
          localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
          localStorage.setItem('npt_session_backup', JSON.stringify({
            sessionUUID: 'dcsr-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
            sessionData: {
              demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' },
              dcsr: ${JSON.stringify(scenario.dcsr) || 'undefined'}
            }
          }));
        }
      ` }, sessionId);
      await send("Page.navigate", { url: appUrl }, sessionId);
      await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), "hydration");
      if (scenario.advance) {
        await click("DCS-R");
        await click("V1");
        await click("Weiter zu DG2");
        await until(async () => (await snapshot()).sessionData.dcsr.dg === 2, "DG2 saved");
        assert.equal((await snapshot()).sessionData.dcsr.counts[0].richtig, 0);
      }
      await send("Page.reload", {}, sessionId);
      await delay(300);
      await until(() => evaluate('[...document.querySelectorAll("button")].some(node => node.textContent.trim() === "CSV Export" && !node.disabled)'), "reload");
      if (scenario.advance) {
        assert.equal((await snapshot()).sessionData.dcsr.dg, 2);
        assert.equal((await snapshot()).sessionData.dcsr.counts[0].richtig, 0);
        assert.equal(await evaluate('document.body.textContent.includes("Durchgang 2 – Scoring")'), true);
      }
      await evaluate(`(() => {
        const original = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          if (blob.type.startsWith('text/csv')) window.dcsrCsv = blob.text();
          return original.call(this, blob);
        };
        HTMLAnchorElement.prototype.click = function() {};
      })()`);
      await click("CSV Export");
      await until(() => evaluate('!!window.dcsrCsv'), "CSV export");
      const csv = await evaluate('window.dcsrCsv');
      const [headers, values] = csv.split("\n").map(line => line.split(";"));
      for (const field of ["dcsr_dg1_hits", "dcsr_sum_dg1_5"]) {
        const index = headers.indexOf(field);
        assert.notEqual(index, -1);
        assert.equal(values[index], scenario.expected, `${scenario.name}: ${field}`);
      }
      console.log(`PASS: ${scenario.name}`);
    } finally {
      await send("Target.disposeBrowserContext", { browserContextId });
    }
  }
} finally {
  socket.close();
}
