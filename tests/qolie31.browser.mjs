import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { calculateQolie31, QOLIE31_SCORING_VERSION } from "../src/lib/qolie31-scoring.js";

// A fresh browser context with synthetic data; never opens a patient session.
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
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 10_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const { browserContextId } = await send("Target.createBrowserContext");
const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function until(check, label) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}
const click = (label) => evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim().replace(/→$/, '').trim() === ${JSON.stringify(label)});
  if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)});
  button.click();
})()`);
const answer = (id, raw) => evaluate(`document.querySelector('input[name="qolie-item-${id}"][value="${raw}"]').click()`);
const snapshot = () => evaluate('JSON.parse(localStorage.getItem("npt_session_backup"))');
const input = (selector, value) => evaluate(`(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, ${JSON.stringify(value)});
  node.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const sliderKey = async (key) => {
  await evaluate('document.querySelector("#qolie-health-input").focus()');
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key }, sessionId);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key }, sessionId);
};
const reloadPage = async (selector = '[data-qolie-item]') => {
  const previousOrigin = await evaluate("performance.timeOrigin");
  await send("Page.reload", {}, sessionId);
  await until(async () => {
    try {
      return await evaluate(`performance.timeOrigin !== ${previousOrigin} && document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`);
    } catch {
      return false; // The old execution context can disappear during navigation.
    }
  }, "new document hydration");
};
const assertCompactAnswers = async () => {
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-qolie-answer-row]')).every(row => {
    const tops = Array.from(row.querySelectorAll('label'), label => label.getBoundingClientRect().top);
    return tops.every(top => Math.abs(top - tops[0]) < 1);
  })`), true);
  for (const number of [2, 9]) {
    assert.equal(await evaluate(`document.getElementById('qolie-block-${number}').parentElement.querySelectorAll('[data-qolie-answer-labels]').length`), 1);
  }
  for (const text of ['Die Subskala „Allgemeine Lebensqualität“ ist nicht der gewichtete Gesamtscore.', 'In diesem Fragebogen stellen wir Fragen', 'Zögern Sie bitte nicht', 'QOLIE 31, copyright 1993, RAND.', '(vergleichbar damit, tot zu sein oder noch schlechter)', 'Separates Gesundheitsthermometer (Item 31).', 'Berechnung und fehlende Antworten', 'Ergebnisse · 0–100', 'Lebensqualität bei Epilepsie QOLIE-31', 'Gesundheitsthermometer: offen', 'Eingaben werden automatisch gespeichert. Unvollständige Fragebögen können mit „Fertig“ verlassen werden.']) {
    assert.equal(await evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`), false);
  }
  assert.equal(await evaluate('document.querySelector("[data-qolie-completion]")'), null);
  assert.equal(await evaluate('document.body.textContent.includes("Auswahl in 10er-Schritten. Erst eine Auswahl speichert eine Antwort")'), false);
};
const epilepsySection = `[...document.querySelectorAll('section')].find(node => node.querySelector('button')?.textContent.includes('Epileptologie – Lokalisationsdiagnostik'))`;
const openEpilepsyOverview = async () => {
  await click("Testungsaufbau für verschiedene Fragestellungen");
  await evaluate(`(() => {
    const section = ${epilepsySection};
    if (!section) throw new Error('Full epilepsy battery missing');
    if (section.querySelector('[aria-hidden]').getAttribute('aria-hidden') === 'true') section.querySelector('button').click();
  })()`);
  assert.equal(await evaluate('document.body.textContent.includes("Digitale Tests laufen in der aufgeführten Reihenfolge. Bei nicht digitalen Bestandteilen erscheint zum passenden Zeitpunkt ein Hinweis.")'), false);
};
const assertScores = async (responses) => {
  const result = calculateQolie31(responses);
  const format = (score) => score === null ? "Nicht verfügbar" : `${score.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 100`;
  assert.equal(await evaluate('document.querySelector("[data-qolie-overall]").textContent'), format(result.overall));
  for (const [key, scale] of Object.entries(result.subscales)) {
    assert.equal(await evaluate(`document.querySelector('[data-qolie-scale="${key}"] [data-qolie-score]').textContent`), format(scale.score));
  }
};
const assertMobile = async () => {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await delay(150);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-qolie-item]')).every(node => node.scrollWidth <= node.clientWidth)`), true);
  await assertCompactAnswers();
};
const screenshot = async (path) => {
  const result = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile(path, Buffer.from(result.data, "base64"));
};

try {
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('qolie_fixture_seeded')) {
      localStorage.setItem('qolie_fixture_seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      localStorage.setItem('sessionUUID', 'qolie-regression');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'qolie-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [
          { id: 'topbar-timed-fixture', label: 'Test-Timer', startTs: Date.now(), durationMs: 3600000, nav: { name: 'qolie31' } },
          { id: 'topbar-untimed-fixture', label: 'Test-Erinnerung', untimed: true, nav: { name: 'qolie31' } }
        ],
        sessionData: { demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' } }
      }));
    }
    const fixture = localStorage.getItem('qolie_reload_fixture');
    if (fixture) {
      const state = JSON.parse(fixture);
      state.lastUpdated = Date.now() + 1000;
      localStorage.setItem('npt_session_backup', JSON.stringify(state));
      localStorage.removeItem('qolie_reload_fixture');
    }
  ` }, sessionId);
  await send("Page.navigate", { url: appUrl }, sessionId);
  await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), "hydration");
  await until(() => evaluate('document.querySelectorAll("#topbar-root button").length === 8'), 'top-bar reminders');
  const topbarSizes = await evaluate('Array.from(document.querySelectorAll("#topbar-root button"), button => getComputedStyle(button).fontSize)');
  assert.deepEqual([...new Set(topbarSizes)], ['14px']);
  await evaluate('document.querySelector(\'button[aria-label="Test-Timer-Erinnerung schließen"]\').click()');
  await evaluate('document.querySelector(\'button[aria-label="Test-Erinnerung-Erinnerung schließen"]\').click()');
  console.log('PASS: uniform top-bar button font size, including timed and untimed reminder controls.');
  await openEpilepsyOverview();
  await evaluate(`(() => {
    const section = ${epilepsySection};
    const row = [...section.querySelectorAll('span')].find(node => node.textContent === 'QOLIE-31')?.parentElement;
    const button = row?.querySelector('button');
    if (!button || button.disabled || button.textContent.trim() !== 'Test starten') throw new Error('QOLIE direct access unavailable');
    button.click();
  })()`);
  assert.equal(await evaluate('document.querySelectorAll("[data-qolie-item]").length'), 31);
  assert.equal(await evaluate('document.querySelectorAll("input[type=radio]:checked").length'), 0);
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").type'), "range");
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").step'), "10");
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").value'), "0");
  await evaluate('document.querySelector("#qolie-health-input").focus()');
  assert.equal(await evaluate('document.querySelector("[data-qolie-health-selection]").textContent'), "Noch nicht beantwortet");
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").value'), "0");
  assert.equal((await snapshot()).sessionData.qolie31?.responses?.[31], undefined);
  await assertCompactAnswers();
  await assertScores({});
  await answer(1, 0);
  assert.equal((await snapshot()).sessionData.qolie31.responses[1], 0);
  assert.equal((await snapshot()).sessionData.qolie31.scoring_version, QOLIE31_SCORING_VERSION);
  await sliderKey("Home");
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 0);
  await sliderKey("ArrowRight");
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 10);
  await sliderKey("Home");
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 0);
  assert.equal(await evaluate('document.querySelector("[data-qolie-health]").textContent'), "0,0 / 100");
  await evaluate('document.querySelector(\'input[name="qolie-item-2"][value="1"]\').focus()');
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }, sessionId);
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }, sessionId);
  await until(async () => (await snapshot()).sessionData.qolie31.responses[2] === 2, "native radio keyboard selection");
  await click("Fertig");
  assert.equal((await snapshot()).screen.name, "frageboegen_menu");
  assert.equal(await evaluate('document.body.textContent.includes("QOLIE-31erfasst")'), true);
  await click("QOLIE-31erfasst");
  assert.equal(await evaluate('document.querySelector(\'input[name="qolie-item-1"][value="0"]\').checked'), true);
  await reloadPage();
  await until(() => evaluate('!!document.querySelector("[data-qolie-item]")'), "reopen draft");
  assert.equal((await snapshot()).sessionData.qolie31.responses[1], 0);
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").value'), "0");
  for (let id = 1; id <= 30; id++) await answer(id, 1);
  const ones = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [index + 1, 1]));
  await assertScores(ones);
  assert.equal(await evaluate('document.querySelector("[data-qolie-overall]").textContent'), "36,2 / 100");
  await sliderKey("End");
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 100);
  await assertScores(ones);
  await sliderKey("Home");
  await evaluate(`document.querySelector('button[aria-label="Antwort für Item 31 löschen"]').click()`);
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], null);
  assert.equal(await evaluate('document.querySelector("[data-qolie-health-selection]").textContent'), "Noch nicht beantwortet");
  await assertScores(ones);
  // Choosing the default zero must save 0 even without a change event.
  await evaluate('document.querySelector("#qolie-health-input").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))');
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 0);
  await sliderKey("Home");
  await input('textarea[aria-label="QOLIE-31 Notiz"]', 'Fixture <script>bad()</script>');
  await evaluate('window.scrollTo(0,0)');
  await screenshot("/private/tmp/npt-qolie-desktop.png");
  await evaluate('document.querySelector("#qolie-block-2").scrollIntoView()');
  await screenshot("/private/tmp/npt-qolie-questionnaire.png");
  await assertMobile();
  await evaluate('window.scrollTo(0,0)');
  await screenshot("/private/tmp/npt-qolie-mobile-results.png");
  await evaluate('document.querySelector("#qolie-block-8").scrollIntoView()');
  await screenshot("/private/tmp/npt-qolie-mobile-questionnaire.png");
  console.log("PASS: compact examiner headings/shared answer labels, single-row numeric controls, removed text, unanswered zero-position slider, ten-point keyboard increments, clearing, explicit zero selection, draft persistence and desktop/mobile layout.");

  await send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  await evaluate(`(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { globalThis.exportedCsv = blob.text(); return original(blob); };
    window.open = () => ({ document: { write: html => { globalThis.pdfHtml = html; }, close: () => {}, open: () => {} } });
  })()`);
  await click("CSV Export");
  await until(() => evaluate('!!globalThis.exportedCsv'), "CSV");
  const [headers, values] = (await evaluate("globalThis.exportedCsv")).split("\n").map(line => line.split(";"));
  const value = (key) => values[headers.indexOf(key)];
  const firstQolieColumn = headers.indexOf("qolie31_entry_mode");
  assert.equal(headers[firstQolieColumn - 1], "rey_copy_abort_note");
  assert.ok(headers.slice(firstQolieColumn).every(header => header.startsWith("qolie31_")));
  assert.equal(value("qolie31_scoring_version"), `"${QOLIE31_SCORING_VERSION}"`);
  assert.equal(value("qolie31_item_1_raw"), '"1"');
  assert.equal(value("qolie31_item_1_score"), '"10"');
  assert.equal(value("qolie31_general_health"), '"0"');
  assert.equal(value("qolie31_scored_completed"), '"1"');
  assert.equal(value("qolie31_completed"), '"1"');
  assert.equal(Number(value("qolie31_cognitive_functioning").replaceAll('"', '')), 100 / 6);
  assert.ok(Math.abs(Number(value("qolie31_overall").replaceAll('"', '')) - 36.2) < 1e-10);
  await click("PDF Export");
  await until(() => evaluate('globalThis.pdfHtml?.includes("qolie31_overall")'), "PDF");
  const pdf = await evaluate("globalThis.pdfHtml");
  assert.ok(pdf.includes(`<td>qolie31_overall</td><td>${calculateQolie31(ones).overall}</td>`));
  assert.ok(pdf.includes("Fixture &lt;script&gt;bad()&lt;/script&gt;"));
  await evaluate(`document.querySelector('button[aria-label="Antwort für Item 11 löschen"]').click()`);
  const partial = { ...ones, 11: null };
  await assertScores(partial);
  assert.equal(calculateQolie31((await snapshot()).sessionData.qolie31.responses).scoredAnsweredCount, 29);
  assert.equal(await evaluate('document.body.textContent.includes("Vorläufig · aus unvollständigen Antworten berechnet.")'), true);
  // Empty an entire subscale through the UI; the overall must become unavailable.
  for (const id of [21, 22, 23, 25]) await evaluate(`document.querySelector('button[aria-label="Antwort für Item ${id} löschen"]').click()`);
  assert.equal(await evaluate('document.querySelector("[data-qolie-overall]").textContent'), "Nicht verfügbar");
  await click("Testabbruch");
  await evaluate('document.querySelector("select").value = "Patientenwunsch"; document.querySelector("select").dispatchEvent(new Event("change", { bubbles: true }))');
  await click("Beenden");
  assert.equal((await snapshot()).sessionData.qolie31_aborted.reason, "Patientenwunsch");
  await click("Zur Fragebogenauswahl");
  await click("QOLIE-31abgebrochen");
  await click("Fragebogen fortsetzen");
  assert.equal((await snapshot()).sessionData.qolie31_aborted, undefined);
  assert.equal((await snapshot()).sessionData.qolie31.responses[1], 1);
  console.log("PASS: seven subscales and overall, unrounded matching CSV/PDF exports appended after all prior columns, health independence, missing items/scales and abort/resume.");

  // Invalid stored codes must also be surfaced (not silently treated as missing).
  await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('npt_session_backup'));
    state.sessionData.qolie31.responses[22] = 4;
    state.sessionData.qolie31.responses[31] = 101;
    localStorage.setItem('qolie_reload_fixture', JSON.stringify(state));
  })()`);
  await reloadPage();
  await until(() => evaluate('document.body.textContent.includes("Item 22: Bitte")'), "persisted invalid code validation");
  await answer(22, 3);
  assert.equal(await evaluate('document.querySelector("input[name=qolie-item-22]").getAttribute("aria-invalid")'), "false");
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").getAttribute("aria-invalid")'), "true");
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(node => node.textContent === "Fertig").disabled'), true);
  await sliderKey("Home");
  assert.equal(await evaluate('document.querySelector("#qolie-health-input").getAttribute("aria-invalid")'), "false");
  await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('npt_session_backup'));
    state.sessionData.qolie31.responses[31] = 55;
    state.activePipeline = { id: 'fixture', title: 'Regression', index: 0, pendingReminders: [], steps: [
      { key: 'qolie31', label: 'QOLIE-31', route: { name: 'qolie31' } },
      { key: 'tmt_ab', label: 'TMT A und B', route: { name: 'tmt_ab' } }
    ] };
    localStorage.setItem('qolie_reload_fixture', JSON.stringify(state));
  })()`);
  await reloadPage();
  await until(() => evaluate('document.body.textContent.includes("Regression") && !!document.querySelector("[data-qolie-item]")'), "pipeline hydration");
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 55);
  assert.equal(await evaluate('document.querySelector("[data-qolie-health-selection]").textContent'), "55 / 100");
  assert.equal(await evaluate('document.querySelector("[data-qolie-health]").textContent'), "55,0 / 100");
  assert.equal(await evaluate('document.body.textContent.includes("Gespeicherter Wert bleibt unverändert.")'), true);
  await click("Fertig");
  assert.equal((await snapshot()).screen.name, "tmt_ab");
  assert.equal((await snapshot()).activePipeline.index, 1);
  await click("Testbatterie beenden");
  await openEpilepsyOverview();
  await evaluate(`[...(${epilepsySection}).querySelectorAll('button')].find(node => node.textContent.trim() === 'Testbatterie starten').click()`);
  const battery = (await snapshot()).activePipeline;
  assert.deepEqual(battery.steps.map(step => step.key), ['vlmt', 'dcsr', 'epi', 'stroop', 'zahl_fwd', 'zahl_rev', 'block_fwd', 'block_rev', 'rwt', 'phq9', 'gad7', 'qolie31']);
  assert.deepEqual(battery.steps.at(-1), { key: 'qolie31', label: 'QOLIE-31', route: { name: 'qolie31' } });
  assert.equal((await snapshot()).screen.name, 'vlmt');
  // Resume the actual configured battery just before QOLIE, without running unrelated tests.
  await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('npt_session_backup'));
    state.activePipeline.index = state.activePipeline.steps.findIndex(step => step.key === 'gad7');
    state.screen = state.activePipeline.steps[state.activePipeline.index].route;
    localStorage.setItem('qolie_reload_fixture', JSON.stringify(state));
  })()`);
  await reloadPage('.testbattery-progress');
  await until(async () => (await snapshot()).screen.name === 'gad7', 'actual battery GAD-7 resume');
  await click('Fertig');
  await until(() => evaluate('!!document.querySelector("[data-qolie-item]")'), 'actual battery QOLIE transition');
  assert.equal((await snapshot()).screen.name, 'qolie31');
  assert.equal((await snapshot()).activePipeline.index, battery.steps.length - 1);
  assert.equal((await snapshot()).sessionData.qolie31.responses[31], 55);
  await click('Fertig');
  assert.equal((await snapshot()).activePipeline, null);
  assert.equal((await snapshot()).screen.name, 'menu');
  console.log('PASS: QOLIE direct access from the overview, actual full epilepsy battery configuration, GAD-7 → QOLIE transition, persisted answers and final battery completion.');
  await evaluate("window.confirm = () => true");
  await click("Neue Testung");
  await until(async () => (await snapshot()).sessionUUID !== "qolie-regression", "new session");
  assert.equal((await snapshot()).sessionData.qolie31, undefined);
  assert.equal((await snapshot()).sessionData.qolie31_aborted, undefined);
  assert.deepEqual(browserErrors, []);
  console.log("PASS: invalid stored codes, legacy health values preserved without rounding, pipeline completion and clean new assessment; no browser exceptions.");
} catch (error) {
  console.error("Browser errors:", JSON.stringify(browserErrors));
  console.error("Page:", await evaluate('document.body?.innerText?.slice(0, 1800)'));
  throw error;
} finally {
  await send("Target.disposeBrowserContext", { browserContextId });
  socket.close();
}
