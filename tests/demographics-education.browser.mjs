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

const { browserContextId } = await send("Target.createBrowserContext");
const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const click = async (label) => {
  await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
  if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(label)});
  button.click();
})()`);
  if (label === "Basisdaten bearbeiten" || label === "Speichern") {
    await until(() => evaluate(`!!document.querySelector('input[type="checkbox"]') === ${label === "Basisdaten bearbeiten"}`), "demographics form toggle");
  }
};
const snapshot = () => evaluate('JSON.parse(localStorage.getItem("npt_session_backup"))');
const toggleManual = async () => {
  const checked = await evaluate(`(() => {
  const label = [...document.querySelectorAll('label')].find(node => node.textContent.trim() === 'Bildungsjahre manuell eingeben');
  const input = label.querySelector('input');
  input.click();
  return input.checked;
})()`);
  await until(() => evaluate(`!!document.getElementById('education-years-total') === ${checked}`), "manual education mode toggle");
};
const fillTotal = (value) => evaluate(`(() => {
  const input = document.getElementById('education-years-total');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const fillBirthDate = (value) => evaluate(`(() => {
  const input = document.getElementById('patient-birth-date');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const saveDisabled = () => evaluate('[...document.querySelectorAll("button")].find(node => node.textContent.trim() === "Speichern").disabled');
const storedSessions = () => evaluate(`new Promise((resolve, reject) => {
  const open = indexedDB.open('npt-db', 2);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    const request = db.transaction('sessions').objectStore('sessions').getAll();
    request.onsuccess = () => { resolve(request.result); db.close(); };
    request.onerror = () => { reject(request.error); db.close(); };
  };
})`);
async function assertBirthDateNotStored() {
  const storage = await evaluate('JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })');
  const database = JSON.stringify(await storedSessions());
  for (const data of [storage, database]) {
    assert.doesNotMatch(data, /1954-06-(15|16|17)|2024-06-(16|17)|birthDate|birth_date|patient_dob|Geburtsdatum/);
  }
}
async function assertExports(expected) {
  const expectedAge = (await snapshot()).sessionData.demographics.patient_age;
  await evaluate(`(() => {
    window.educationCsv = null;
    window.educationPdf = '';
    const original = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      if (blob.type.startsWith('text/csv')) window.educationCsv = blob.text();
      return original.call(this, blob);
    };
    HTMLAnchorElement.prototype.click = function() {};
    window.open = () => ({ document: { write: html => { window.educationPdf = html; }, close() {}, open() {} } });
  })()`);
  await click("CSV Export");
  await until(() => evaluate('!!window.educationCsv'), "CSV export");
  const csv = await evaluate('window.educationCsv');
  const [headers, values] = csv.split("\n").map(line => line.split(";"));
  assert.equal(headers.filter(key => key === "demographics_education_years").length, 1);
  assert.equal(values[headers.indexOf("demographics_education_years")], `"${expected}"`);
  assert.equal(headers.filter(key => key === "demographics_patient_age").length, 1);
  assert.equal(values[headers.indexOf("demographics_patient_age")], `"${expectedAge}"`);
  assert.doesNotMatch(csv, /birth|geburt|1954-06-/i);
  await click("PDF Export");
  await until(() => evaluate('window.educationPdf.includes("demographics_education_years")'), "PDF export");
  assert.equal(await evaluate(`(() => {
    const doc = new DOMParser().parseFromString(window.educationPdf, 'text/html');
    const row = [...doc.querySelectorAll('tr')].find(node => node.firstElementChild?.textContent === 'demographics_education_years');
    return row.lastElementChild.textContent;
  })()`), String(expected));
  assert.equal(await evaluate(`(() => {
    const doc = new DOMParser().parseFromString(window.educationPdf, 'text/html');
    const row = [...doc.querySelectorAll('tr')].find(node => node.firstElementChild?.textContent === 'demographics_patient_age');
    return row.lastElementChild.textContent;
  })()`), String(expectedAge));
  assert.doesNotMatch(await evaluate('window.educationPdf'), /birth|geburt|1954-06-/i);
}

try {
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setTimezoneOverride", { timezoneId: "Europe/Berlin" }, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('education_fixture_seeded')) {
      localStorage.setItem('education_fixture_seeded', 'true');
      localStorage.setItem('auth_ok', 'true');
      localStorage.setItem('sessionUUID', 'education-regression');
      const now = new Date();
      localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({
        sessionUUID: 'education-regression', lastUpdated: Date.now(), screen: { name: 'menu' }, globalTimers: [],
        sessionData: { testing_started_at: Date.parse('2024-06-15T22:30:00Z'), demographics_saved: true, demographics: {
          patient_initials: 'TEST', patient_age: '70', test_language: 'de',
          education_school_years: 13, education_training_code: 'master', education_years: 18
        } }
      }));
    }
  ` }, sessionId);
  await send("Page.navigate", { url: appUrl }, sessionId);
  await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), "hydration");
  await click("Basisdaten bearbeiten");
  assert.equal(await evaluate('document.querySelector(\'label[for="patient-birth-date"]\').textContent'), 'Geburtsdatum');
  assert.equal(await evaluate('document.getElementById("patient-birth-date").type'), 'date');
  assert.equal(await evaluate('document.getElementById("patient-birth-date").max'), '2024-06-16');
  assert.equal(await evaluate('document.getElementById("patient-birth-date").value'), '');
  await fillBirthDate('2024-06-17');
  assert.equal(await saveDisabled(), true);
  assert.equal(await evaluate('document.getElementById("patient-birth-date").getAttribute("aria-invalid")'), 'true');
  for (const [birthDate, expectedAge] of [['1954-06-17', '69'], ['1954-06-16', '70'], ['1954-06-15', '70'], ['2024-06-16', '0']]) {
    const previousAge = (await snapshot()).sessionData.demographics.patient_age;
    await fillBirthDate(birthDate);
    assert.equal(await saveDisabled(), false);
    assert.equal(await evaluate(`document.getElementById('patient-age-help').textContent.includes('Alter am Untersuchungstag: ${expectedAge} Jahre.')`), true);
    await evaluate('window.dispatchEvent(new Event("pagehide"))');
    await assertBirthDateNotStored();
    assert.equal((await snapshot()).sessionData.demographics.patient_age, previousAge);
    await click('Speichern');
    assert.equal((await snapshot()).sessionData.demographics.patient_age, expectedAge);
    await until(async () => (await storedSessions()).some(item => item.sessionData?.demographics?.patient_age === expectedAge), 'saved age in IndexedDB');
    await assertBirthDateNotStored();
    await assertExports(18);
    await click('Basisdaten bearbeiten');
    assert.equal(await evaluate('document.getElementById("patient-birth-date").value'), '');
  }
  // A blank field on reopen must preserve the age saved without a birth date.
  await click('Speichern');
  assert.equal((await snapshot()).sessionData.demographics.patient_age, '0');
  await evaluate('window.ageReloadPending = true');
  await send('Page.reload', {}, sessionId);
  await until(() => evaluate('!window.ageReloadPending && !!document.querySelector(".tile-btn:not(:disabled)")'), 'age reload');
  await click('Basisdaten bearbeiten');
  assert.equal(await evaluate('document.getElementById("patient-birth-date").value'), '');
  assert.equal((await snapshot()).sessionData.demographics.patient_age, '0');
  console.log('PASS: birth-date entry calculates age on the local examination date, validates future dates, preserves zero and stores/exports only age.');
  assert.equal(await evaluate('document.body.textContent.includes("Berechnete Bildungsjahre: 18")'), true);
  assert.equal(await evaluate(`(() => {
    const labels = [...document.querySelectorAll('label')].map(node => node.textContent.trim());
    return labels.indexOf('Testsprache') > labels.indexOf('Bildungsjahre manuell eingeben')
      && labels.indexOf('Testsprache') > labels.indexOf('Längste absolvierte Ausbildung');
  })()`), true);
  await toggleManual();
  assert.equal(await evaluate('document.body.textContent.includes("Schulabschluss (Jahre, ohne Wiederholung)")'), false);
  assert.equal(await evaluate('document.body.textContent.includes("Längste absolvierte Ausbildung")'), false);
  assert.equal(await evaluate('document.getElementById("education-years-total").value'), "18");
  for (const value of ["", "-1"]) {
    await fillTotal(value);
    assert.equal(await saveDisabled(), true);
    assert.equal(await evaluate('document.getElementById("education-years-total").getAttribute("aria-invalid")'), "true");
  }
  await fillTotal("11.5");
  assert.equal(await saveDisabled(), false);
  await click("Speichern");
  assert.equal((await snapshot()).sessionData.demographics.education_years, 11.5);
  assert.equal((await snapshot()).sessionData.demographics.education_years_manual, true);
  await assertExports(11.5);
  await send("Page.reload", {}, sessionId);
  await delay(300);
  await until(() => evaluate('!!document.querySelector(".tile-btn:not(:disabled)")'), "reload");
  await click("Basisdaten bearbeiten");
  assert.equal(await evaluate('document.getElementById("education-years-total").value'), "11.5");
  // Saving demographics again must not silently restore the calculated total.
  await click("Speichern");
  assert.equal((await snapshot()).sessionData.demographics.education_years, 11.5);
  console.log("PASS: manual fractional total survives saving/reload/editing and CSV/PDF exports");
  await click("Basisdaten bearbeiten");
  await fillTotal("0");
  assert.equal(await saveDisabled(), false);
  await click("Speichern");
  assert.equal((await snapshot()).sessionData.demographics.education_years, 0);
  await assertExports(0);
  console.log("PASS: zero is valid; blank and negative manual totals cannot be saved");
  await click("Basisdaten bearbeiten");
  await toggleManual();
  await until(() => evaluate('!document.getElementById("education-years-total")'), "automatic education mode");
  assert.equal(await evaluate('document.body.textContent.includes("Berechnete Bildungsjahre: 18")'), true);
  // Hold delayed synchronization callbacks through save/reopen to detect any
  // stale frame that could overwrite the next editing session's draft.
  await evaluate(`(() => {
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    const held = new Map(); let sequence = 0;
    window.requestAnimationFrame = callback => { const id = --sequence; held.set(id, callback); return id; };
    window.cancelAnimationFrame = id => { if (id < 0) held.delete(id); else cancel.call(window, id); };
    window.flushDemographicFrames = () => {
      window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel;
      const callbacks = [...held.values()]; held.clear();
      callbacks.forEach(callback => callback(performance.now()));
    };
  })()`);
  await click("Speichern");
  assert.equal((await snapshot()).sessionData.demographics.education_years, 18);
  assert.equal((await snapshot()).sessionData.demographics.education_years_manual, false);
  await assertExports(18);
  console.log("PASS: disabling manual input restores automatic calculation and exports");
  await click("Basisdaten bearbeiten");
  for (const label of ["Schulabschluss (Jahre, ohne Wiederholung)", "Längste absolvierte Ausbildung"]) {
    await evaluate(`(() => {
      const label = [...document.querySelectorAll('label')].find(node => node.textContent.trim() === ${JSON.stringify(label)});
      const select = label.parentElement.querySelector('select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }
  await toggleManual();
  await fillTotal("8");
  await evaluate('window.flushDemographicFrames(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.equal(await evaluate('document.getElementById("education-years-total").value'), "8");
  await click("Speichern");
  const demo = (await snapshot()).sessionData.demographics;
  assert.equal(demo.education_years, 8);
  assert.equal(demo.education_school_years, 0);
  assert.equal(demo.education_training_years, 0);
  await assertExports(8);
  console.log("PASS: manual total works without compatible school/training dropdown selections");
  console.log("PASS: delayed frames from a previous save cannot overwrite a reopened demographic draft.");
  await click('Basisdaten bearbeiten');
  await fillTotal('20');
  await evaluate('window.confirm = () => true');
  const previousSession = (await snapshot()).sessionUUID;
  await click('Neue Testung');
  await until(async () => (await snapshot()).sessionUUID !== previousSession, 'new assessment');
  await until(() => evaluate('!!document.querySelector(\'input[placeholder="z. B. AB"]\')'), 'fresh demographic form');
  assert.equal(await evaluate('document.querySelector(\'input[placeholder="z. B. AB"]\').value'), '');
  assert.equal(await evaluate('document.querySelector(\'input[type="checkbox"]\').checked'), false);
  assert.equal(await evaluate('document.getElementById("education-years-total")'), null);
  const today = await evaluate(`(() => { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); })()`);
  assert.equal(await evaluate('document.getElementById("patient-birth-date").max'), today);
  await fillBirthDate('2000-01-01');
  await click('Speichern');
  assert.equal((await snapshot()).sessionData.demographics.patient_age, String(Number(today.slice(0, 4)) - 2000));
  console.log('PASS: starting a new assessment discards the previous unsaved demographic draft.');
  console.log('PASS: new assessments calculate age using today before the first test has started.');
} finally {
  await send("Target.disposeBrowserContext", { browserContextId });
  socket.close();
}
