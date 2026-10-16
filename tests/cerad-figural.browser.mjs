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
const zeros = { kreis: 0, rhombus: 0, rechtecke: 0, wuerfel: 0 };

try {
  for (const scenario of ["unfinished", "zero", "partial", "cleared"]) {
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
        if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('cerad_fixture_seeded')) {
          localStorage.setItem('cerad_fixture_seeded', 'true');
          localStorage.setItem('auth_ok', 'true');
          localStorage.setItem('sessionUUID', 'cerad-regression');
          const now = new Date();
          localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
          localStorage.setItem('npt_session_backup', JSON.stringify({
            sessionUUID: 'cerad-regression', lastUpdated: Date.now(), screen: { name: 'cerad_fig' }, globalTimers: [],
            sessionData: {
              demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' },
              cerad_fig: { draw_scores: { kreis: 2 }, recall_pending: true }
            }
          }));
        }
      ` }, sessionId);
      await send("Page.navigate", { url: appUrl }, sessionId);
      await until(() => evaluate('document.body.textContent.includes("Direkt zum Abruf")'), "figure screen");
      assert.equal((await snapshot()).sessionData.cerad_fig.recall_scores, undefined);
      await click("Direkt zum Abruf");
      await until(() => evaluate('document.body.textContent.includes("Figuren erinnern")'), "recall screen");
      // Merely opening recall must not turn a missing test into a zero score.
      assert.equal((await snapshot()).sessionData.cerad_fig.recall_scores, undefined);
      if (scenario === "partial" || scenario === "cleared") {
        await click("a) geschlossener Kreis (Lücken ≤ 3 Millimeter)");
        if (scenario === "cleared") await click("a) geschlossener Kreis (Lücken ≤ 3 Millimeter)");
      }
      await click(scenario === "unfinished" ? "Zur CERAD-Auswahl" : "Fertig");
      const expected = scenario === "unfinished" ? undefined : { ...zeros, kreis: scenario === "partial" ? 1 : 0 };
      const saved = (await snapshot()).sessionData.cerad_fig;
      assert.deepEqual(saved.recall_scores, expected);
      assert.deepEqual(saved.draw_scores, { kreis: 2 });
      assert.equal(saved.recall_pending, scenario === "unfinished");
      await send("Page.reload", {}, sessionId);
      await delay(300);
      await until(() => evaluate('[...document.querySelectorAll("button")].some(node => node.textContent.trim() === "CSV Export" && !node.disabled)'), "reload");
      assert.deepEqual((await snapshot()).sessionData.cerad_fig.recall_scores, expected);
      // Capture the actual CSV download to check missing values versus numeric zero.
      await evaluate(`(() => {
        const original = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          if (blob.type.startsWith('text/csv')) window.ceradCsv = blob.text();
          return original.call(this, blob);
        };
        HTMLAnchorElement.prototype.click = function() {};
      })()`);
      await click("CSV Export");
      await until(() => evaluate('!!window.ceradCsv'), "CSV export");
      const csv = await evaluate('window.ceradCsv');
      const [headers, values] = csv.split("\n").map(line => line.split(";"));
      for (const key of Object.keys(zeros)) {
        const index = headers.indexOf(`cerad_fig_recall_${key}`);
        assert.notEqual(index, -1);
        assert.equal(values[index], scenario === "unfinished" ? "" : `"${expected[key]}"`);
      }
      console.log(`PASS: ${scenario} recall persists and exports correctly`);
    } finally {
      await send("Target.disposeBrowserContext", { browserContextId });
    }
  }
} finally {
  socket.close();
}
