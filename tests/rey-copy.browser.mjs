import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Dedicated browser context with synthetic data; never uses an existing session.
const appUrl = process.env.NPT_APP_URL || "http://127.0.0.1:5178";
const debugUrl = process.env.NPT_CDP_URL || "http://127.0.0.1:9227";
const notes = 'Detail-first; <script>window.bad=1</script> & "notes"';
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
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
  if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)});
  button.click();
})()`);
const selectElement = (id) => evaluate(`document.querySelector('[data-rey-element="${id}"]').click()`);
const score = async (id, value) => {
  await selectElement(id);
  await evaluate(`document.querySelector('button[aria-label="Element ${id}: ${String(value).replace(".", ",")} Punkte"]').click()`);
};
const snapshot = () => evaluate('JSON.parse(localStorage.getItem("npt_session_backup"))');
const completionDisabled = () => evaluate('[...document.querySelectorAll("button")].find(node => node.textContent === "Rey-Kopie abschließen").disabled');
const assertVersionChoice = async () => {
  assert.equal(await evaluate(`document.querySelectorAll('section[aria-label="Rey-Figur – Versionswahl"] svg').length`), 2);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('section[aria-label="Rey-Figur – Versionswahl"] button'), node => node.textContent.trim())`), ["Version 1 wählen", "Version 2 wählen"]);
  for (const text of ["Beide Versionen verwenden dieselbe ROCFT-Auswertung.", "Kopie · 18 Elemente · maximal 36 Punkte", "Gespeicherte Bewertung:", "Noch keine Elemente bewertet"]) {
    assert.equal(await evaluate(`document.querySelector('section[aria-label="Rey-Figur – Versionswahl"]').textContent.includes(${JSON.stringify(text)})`), false);
  }
};
const assertSimplifiedLayout = async () => {
  assert.equal(await evaluate(`(() => {
    const section = document.querySelector('section[aria-label="Rey-Figur – Kopie"]');
    const figure = section.querySelector('svg').getBoundingClientRect();
    const navigation = section.querySelector('[data-rey-navigation]').getBoundingClientRect();
    const help = section.querySelector('[data-rey-help]').getBoundingClientRect();
    return navigation.top >= figure.bottom && Math.abs(navigation.left - figure.left) < 10
      && Math.abs(navigation.width - figure.width) < 20 && Math.abs(help.width - section.clientWidth) < 2;
  })()`), true);
  for (const label of ["Nach Bewertung zum nächsten offenen Element", "Nummern ausblenden", "Nummern einblenden", "Referenzfigur", "Kopierzeit & Beobachtungen"]) {
    assert.equal(await evaluate(`document.body.textContent.includes(${JSON.stringify(label)})`), false);
  }
  assert.equal(await evaluate('document.body.textContent.includes("Nummer anklicken und das Element bewerten. Grün = bewertet.")'), true);
  assert.equal(await evaluate('document.querySelectorAll("svg g[role=button]").length'), 18);
};

try {
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('rey_fixture_seeded')) {
      localStorage.setItem('rey_fixture_seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      // A saved preference for the removed quiet theme must not affect the app.
      localStorage.setItem('npt_design_theme', 'legacy');
      localStorage.setItem('sessionUUID', 'rey-regression');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'rey-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
        sessionData: {
          demographics_saved: true, demographics: { patient_initials: 'TEST', patient_age: '70', test_language: 'de' },
          rey_copy: { versions: { '1': { notes: ${JSON.stringify(notes)}, duration_s: 185.5 } } }
        }
      }));
    }
  ` }, sessionId);
  await send("Page.navigate", { url: appUrl }, sessionId);
  await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), "hydration");
  assert.equal(await evaluate('document.body.textContent.includes("Ruhiger Modus")'), false);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Zwischen ruhigem und farbenfrohem Design umschalten"]')`), null);
  assert.equal(await evaluate('getComputedStyle(document.body).backgroundImage.includes("radial-gradient")'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".tile-accent")).display !== "none"'), true);
  await click("Rey-Figur");
  await assertVersionChoice();
  await click("Version 1 wählen");
  assert.equal(await completionDisabled(), true);
  assert.equal(await evaluate('document.querySelector("[data-rey-total]").textContent'), "— / 36");
  assert.equal(await evaluate('document.querySelectorAll("[data-rey-element]").length'), 18);
  assert.equal(await evaluate('document.querySelectorAll("svg g[role=button]").length'), 18);
  await assertSimplifiedLayout();
  const material = await evaluate('fetch("/material/rey-osterrieth-v1.png").then(response => ({ ok: response.ok, type: response.headers.get("content-type") }))');
  assert.equal(material.ok, true);
  assert.equal(material.type, "image/png");
  assert.deepEqual(await evaluate(`new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = reject;
    image.src = '/material/rey-osterrieth-v1.png';
  })`), [2592, 1770]);
  await score(1, 0.5);
  await score(2, 0);
  assert.equal((await snapshot()).sessionData.rey_copy.scores[1], 0.5);
  assert.equal((await snapshot()).sessionData.rey_copy.scores[2], 0);
  await evaluate(`document.querySelector('button[aria-label="Bewertung für Element 2 löschen"]').click()`);
  assert.equal((await snapshot()).sessionData.rey_copy.scores[2], null);
  assert.equal(await evaluate('document.querySelector("[data-rey-progress]").textContent'), "1 / 18 bewertet");
  await click("Übersicht");
  assert.equal(await evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("Rey-Figur")).textContent.includes("in Bearbeitung")'), true);
  await click("Rey-Figurin Bearbeitung");
  await send("Page.reload", {}, sessionId);
  await delay(300);
  await until(() => evaluate('!!document.querySelector("[data-rey-element]")'), "reload");
  await selectElement(1);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Element 1: 0,5 Punkte"]').getAttribute('aria-pressed')`), "true");
  await selectElement(2);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Element 2: 0 Punkte"]').getAttribute('aria-pressed')`), "false");
  await evaluate('document.querySelectorAll("svg g[role=button]")[10].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  assert.equal(await evaluate('document.querySelector("[data-rey-highlight]").dataset.reyHighlight'), "11");
  await click("← Vorheriges");
  assert.equal(await evaluate('document.querySelector("[data-rey-highlight]").dataset.reyHighlight'), "10");
  await click("Nächstes →");
  assert.equal(await evaluate('document.querySelector("[data-rey-highlight]").dataset.reyHighlight'), "11");
  await selectElement(1);
  assert.equal(await evaluate('document.querySelector("[data-rey-navigation] button:first-child").disabled'), true);
  const beforeSelection = await evaluate('window.scrollY');
  await evaluate('document.querySelectorAll("svg g[role=button]")[17].dispatchEvent(new MouseEvent("click", { bubbles: true }))');
  await delay(100);
  assert.equal(await evaluate('window.scrollY'), beforeSelection);
  assert.equal(await evaluate(`document.querySelectorAll('[data-rey-scoring-panel] button[aria-label^="Element 18:"]').length`), 4);
  assert.equal(await evaluate('document.querySelector("[data-rey-navigation] button:last-child").disabled'), true);
  for (let id = 1; id <= 18; id++) await score(id, 2);
  assert.equal(await completionDisabled(), false);
  assert.equal(await evaluate('document.querySelector("[data-rey-total]").textContent'), "36 / 36");
  await score(1, 0.5);
  await score(2, 0);
  // Previously saved notes/time remain intact despite removal of their UI fields.
  assert.equal((await snapshot()).sessionData.rey_copy.duration_s, 185.5);
  assert.equal((await snapshot()).sessionData.rey_copy.notes, notes);
  await evaluate('window.scrollTo(0,0)');
  await delay(200);
  const screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile("/private/tmp/npt-rey-desktop.png", Buffer.from(screenshot.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await delay(100);
  await assertSimplifiedLayout();
  assert.equal(await evaluate(`(() => { const section = document.querySelector('section[aria-label="Rey-Figur – Kopie"]'); return section.scrollWidth <= section.clientWidth; })()`), true);
  assert.equal(await evaluate(`(() => {
    const figure = document.querySelector('svg').getBoundingClientRect();
    const points = document.querySelector('[data-rey-scoring-panel] [role="group"]').getBoundingClientRect();
    return figure.top >= 0 && figure.bottom <= innerHeight && points.top >= 0 && points.bottom <= innerHeight;
  })()`), true);
  const mobileScreenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile("/private/tmp/npt-rey-mobile.png", Buffer.from(mobileScreenshot.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  await click("Version wählen");
  await assertVersionChoice();
  await click("Version 2 wählen");
  assert.equal((await snapshot()).sessionData.rey_copy.version, "2");
  assert.deepEqual((await snapshot()).sessionData.rey_copy.scores, {});
  assert.equal(await evaluate('document.querySelector("[data-rey-progress]").textContent'), "0 / 18 bewertet");
  assert.equal(await evaluate('document.querySelector("svg image").getAttribute("href")'), "/material/rey-taylor-v2.png");
  assert.deepEqual(await evaluate(`new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = reject;
    image.src = '/material/rey-taylor-v2.png';
  })`), [2420, 1898]);
  assert.equal(await evaluate('document.body.textContent.includes("Taylor")'), false);
  await score(14, 0.5);
  await send("Page.reload", {}, sessionId);
  await delay(300);
  await until(() => evaluate('!!document.querySelector("[data-rey-element]")'), "version 2 reload");
  assert.equal((await snapshot()).sessionData.rey_copy.version, "2");
  assert.equal((await snapshot()).sessionData.rey_copy.scores[14], 0.5);
  await score(1, 2);
  assert.equal(await evaluate('document.querySelector("[data-rey-highlight]").dataset.reyHighlight'), "1");
  await click("Nächstes →");
  assert.equal(await evaluate('document.querySelector("[data-rey-highlight]").dataset.reyHighlight'), "2");
  await score(18, 1);
  await assertSimplifiedLayout();
  await delay(200);
  await assertSimplifiedLayout();
  const version2Screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile("/private/tmp/npt-rey-v2-desktop.png", Buffer.from(version2Screenshot.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await evaluate('window.scrollTo(0,0)');
  await delay(200);
  assert.equal(await evaluate(`(() => {
    const figure = document.querySelector('svg').getBoundingClientRect();
    const points = document.querySelector('[data-rey-scoring-panel] [role="group"]').getBoundingClientRect();
    return figure.top >= 0 && figure.bottom <= innerHeight && points.top >= 0 && points.bottom <= innerHeight;
  })()`), true);
  const version2MobileScreenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  await writeFile("/private/tmp/npt-rey-v2-mobile.png", Buffer.from(version2MobileScreenshot.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 1360, height: 1050, deviceScaleFactor: 1, mobile: false }, sessionId);
  for (let id = 1; id <= 18; id++) await score(id, 2);
  assert.equal(await evaluate('document.querySelector("[data-rey-total]").textContent'), "36 / 36");
  await click("Version wählen");
  await click("Version 1 wählen");
  assert.equal((await snapshot()).sessionData.rey_copy.notes, notes);
  assert.equal((await snapshot()).sessionData.rey_copy.duration_s, 185.5);
  assert.equal(await evaluate('document.querySelector("[data-rey-total]").textContent'), "32,5 / 36");
  console.log("PASS: version choice, independent draft preservation, version 2 mapping/reload, manual navigation, and compact selection without scrolling.");
  console.log("PASS: copy-only scoring, highlights, keyboard selection, clearing, reload, fractional total, legacy notes, and simplified responsive layout.");

  await evaluate(`(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = blob => { globalThis.exportedCsv = blob.text(); return original(blob); };
    window.open = () => ({ document: { write: html => { globalThis.pdfHtml = html; }, close: () => {}, open: () => {} } });
  })()`);
  await click("CSV Export");
  await until(() => evaluate('!!globalThis.exportedCsv'), "CSV");
  const csv = await evaluate("globalThis.exportedCsv");
  const [headers, values] = csv.split("\n").map(line => line.split(";"));
  assert.equal(values[headers.indexOf("rey_copy_total")], '"32.5"');
  assert.equal(values[headers.indexOf("rey_copy_element_2")], '"0"');
  assert.equal(values[headers.indexOf("rey_copy_completed")], '"1"');
  const v1Headers = headers;
  const firstReyColumn = headers.indexOf('rey_copy_version');
  assert.equal(headers[firstReyColumn - 1], 'gds_aborted');
  const firstQolieColumn = headers.indexOf('qolie31_entry_mode');
  assert.equal(headers[firstQolieColumn - 1], 'rey_copy_abort_note');
  assert.ok(headers.slice(firstReyColumn, firstQolieColumn).every(header => header.startsWith('rey_copy_')));
  assert.ok(headers.slice(firstQolieColumn).every(header => header.startsWith('qolie31_')));
  await click("Version wählen");
  await click("Version 2 wählen");
  await evaluate('globalThis.exportedCsv = null');
  await click("CSV Export");
  await until(() => evaluate('!!globalThis.exportedCsv'), "version 2 CSV");
  const [v2Headers, v2Values] = (await evaluate("globalThis.exportedCsv")).split("\n").map(line => line.split(";"));
  assert.deepEqual(v2Headers, v1Headers);
  assert.equal(v2Values[v2Headers.indexOf("rey_copy_version")], '"2"');
  assert.equal(v2Values[v2Headers.indexOf("rey_copy_total")], '"36"');
  assert.equal(v2Headers.some((header) => header.includes("taylor") || header.includes("rey_copy_v2_")), false);
  await click("PDF Export");
  await until(() => evaluate('globalThis.pdfHtml?.includes("<td>rey_copy_version</td><td>2</td>")'), "version 2 PDF");
  assert.ok((await evaluate("globalThis.pdfHtml")).includes("<td>rey_copy_total</td><td>36</td>"));
  await click("Version wählen");
  await click("Version 1 wählen");
  await click("PDF Export");
  await until(() => evaluate('globalThis.pdfHtml?.includes("rey_copy_total")'), "PDF");
  const pdf = await evaluate("globalThis.pdfHtml");
  assert.ok(pdf.includes("<td>rey_copy_total</td><td>32.5</td>"));
  assert.ok(pdf.includes("&lt;script&gt;window.bad=1&lt;/script&gt; &amp; &quot;notes&quot;"));
  await click("Rey-Kopie abschließen");
  assert.equal((await snapshot()).screen.name, "menu");
  assert.equal(await evaluate('[...document.querySelectorAll(".tile-btn")].find(node => node.textContent.includes("Rey-Figur")).textContent.includes("erfasst")'), true);
  console.log("PASS: completed menu status and CSV/PDF exports include the validated raw total and safely rendered notes.");

  await click("Rey-Figurerfasst");
  await click("Testabbruch");
  await evaluate('document.querySelector("select").value = "Patientenwunsch"; document.querySelector("select").dispatchEvent(new Event("change", { bubbles: true }))');
  await click("Beenden");
  assert.equal((await snapshot()).sessionData.rey_copy_aborted.reason, "Patientenwunsch");
  await click("Rey-Figurabgebrochen");
  assert.equal(await completionDisabled(), true);
  await click("Bewertung fortsetzen");
  assert.equal(await completionDisabled(), false);
  assert.equal((await snapshot()).sessionData.rey_copy.scores[1], 0.5);
  await evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem('npt_session_backup'));
    state.screen = { name: 'rey_copy' };
    state.activePipeline = { id: 'fixture', title: 'Regression', index: 0, pendingReminders: [], steps: [
      { key: 'rey_copy', label: 'Rey-Figur', route: { name: 'rey_copy' } },
      { key: 'tmt_ab', label: 'TMT A und B', route: { name: 'tmt_ab' } }
    ] };
    localStorage.setItem('rey_pipeline_fixture', JSON.stringify(state));
  })()`);
  // Install the fixture after the old document's pagehide persistence flush.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    const fixture = localStorage.getItem('rey_pipeline_fixture');
    if (fixture) {
      const state = JSON.parse(fixture);
      state.lastUpdated = Date.now() + 1000;
      localStorage.setItem('npt_session_backup', JSON.stringify(state));
      localStorage.removeItem('rey_pipeline_fixture');
    }
  ` }, sessionId);
  await send("Page.reload", {}, sessionId);
  await delay(300);
  await until(() => evaluate('document.body.textContent.includes("Regression") && !!document.querySelector("[data-rey-element]")'), "pipeline restore");
  await click("Rey-Kopie abschließen");
  assert.equal((await snapshot()).screen.name, "tmt_ab");
  assert.equal((await snapshot()).activePipeline.index, 1);
  await evaluate("window.confirm = () => true");
  await click("Neue Testung");
  await until(async () => (await snapshot()).sessionUUID !== "rey-regression", "new session");
  assert.equal((await snapshot()).sessionData.rey_copy, undefined);
  assert.equal((await snapshot()).sessionData.rey_copy_aborted, undefined);
  assert.deepEqual(browserErrors, []);
  console.log("PASS: abort/resume preserves scores, pipeline advances, and a new patient starts without previous Rey data.");
} catch (error) {
  console.error("Browser errors:", JSON.stringify(browserErrors));
  console.error("Page:", await evaluate('document.body?.innerText?.slice(0, 1800)'));
  throw error;
} finally {
  await send("Target.disposeBrowserContext", { browserContextId });
  socket.close();
}
