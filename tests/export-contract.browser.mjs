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
  { name: "new unassessed examination", data: { collection_version: 2 }, expect: { tmt_a_s: "", tmt_a_s_missing_reason: "not-performed", tmt_assessment_status: "not-performed", export_schema_version: "2", moca_education_correction_missing_reason: "unsupported" } },
  { name: "legacy unknown", data: {}, expect: { tmt_a_s_missing_reason: "unknown", tmt_assessment_status: "unknown" } },
  { name: "partial scores and real zero", data: { collection_version: 2, tmt_a: 0, ace: { scores: { orientation_time: 0 } }, moca: { scores: { orientation: 1 } }, vlmt: { list: "A", step: "score", dg: 1, results: [{ sel: {} }] }, stroop: { woerter: 1000 } }, expect: { tmt_a_s: "0", tmt_a_s_missing_reason: "", tmt_b_s_missing_reason: "unknown", ace_attention_orientation_time: "0", ace_total: "", moca_total: "", vlmt_dg7_hits: "", vlmt_sum_dg1_5: "", stroop_interferenz_errors: "" } },
  { name: "aborted cap", data: { tmt_a: 180000, tmt_a_aborted: { reason: "Stopped" } }, expect: { tmt_a_s: "", tmt_assessment_status: "aborted", tmt_a_aborted: "1" } },
  { name: "saved complete zero trials", data: { cerad_wl: { dg1: { marks: {}, intrusions: 0, assessed: true } }, dcsr: { step: "waiting", dg: 5, counts: Array.from({ length: 5 }, () => ({ richtig: 0, assessed: true })), rekog: { responses: { korrekt: 0 }, assessed: true } } }, expect: { cerad_wl_dg1_hits: "0", cerad_wl_dg2_hits: "", dcsr_sum_dg1_5: "0", dcsr_rekog_correct: "0", dcsr_rekog_correct_missing_reason: "" } },
  { name: "completed zero naming and MMST", data: { cerad_benennen: { items: Array.from({ length: 15 }, () => ({ correct: false })) }, cerad_mmst: { assessment_complete: true } }, expect: { cerad_bnt_correct: "0", cerad_bnt_assessment_status: "completed", cerad_mmst_total: "0", cerad_mmst_assessment_status: "completed" } },
  { name: "MoCA explicit zero action", data: { collection_version: 2, moca: { version: "A", language: "de" } }, zeroTest: "moca", expect: { moca_visuospatial_executive_trail: "0", moca_visuospatial_executive_cube: "", moca_total: "", moca_visuospatial_executive_trail_missing_reason: "" } },
  { name: "ACE explicit zero action", data: { collection_version: 2, ace: { version: "A" } }, zeroTest: "ace", expect: { ace_attention_orientation_time: "0", ace_total: "", ace_attention_orientation_time_missing_reason: "" } },
  { name: "advance without points survives reload", data: { collection_version: 2 }, advance: true, expect: { dcsr_dg1_hits: "0", dcsr_dg1_hits_missing_reason: "", dcsr_sum_dg1_5: "", dcsr_assessment_status: "recorded" } },
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
              ...${JSON.stringify(scenario.data)}
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
      if (scenario.zeroTest) {
        await click(scenario.zeroTest === "moca" ? "MoCA" : "ACE-III");
        await until(() => evaluate('[...document.querySelectorAll("button")].some(node => node.textContent.trim() === "0 Punkte erfassen")'), "zero score action");
        await click("0 Punkte erfassen");
        await until(async () => Object.values((await snapshot()).sessionData[scenario.zeroTest].scores || {}).includes(0), "explicit zero saved");
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
      assert.equal(new Set(headers).size, headers.length, "unique column names");
      for (const [field, expected] of Object.entries(scenario.expect)) {
        const index = headers.indexOf(field);
        assert.notEqual(index, -1, field);
        assert.equal(values[index].replace(/^"|"$/g, ""), expected, `${scenario.name}: ${field}`);
      }
      if (scenario.advance) assert.equal((await snapshot()).sessionData.dcsr.counts[0].assessed, true);
      console.log(`PASS: ${scenario.name}`);
    } finally {
      await send("Target.disposeBrowserContext", { browserContextId });
    }
  }
} finally {
  socket.close();
}
