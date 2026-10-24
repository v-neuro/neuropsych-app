import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const appUrl = process.env.NPT_APP_URL || 'http://127.0.0.1:5178';
const debugUrl = process.env.NPT_CDP_URL || 'http://127.0.0.1:9227';
const { webSocketDebuggerUrl } = await (await fetch(`${debugUrl}/json/version`)).json();
const socket = new WebSocket(webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), request = pending.get(message.id);
  if (message.method === 'Runtime.exceptionThrown' || (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')) errors.push(message.params);
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
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
  await send('Page.bringToFront', {}, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (check, label) => {
    for (let i = 0; i < 200; i++) { if (await check()) return; await delay(50); }
    throw new Error(`Timeout: ${label}`);
  };
  const snapshot = () => evaluate('JSON.parse(localStorage.npt_session_backup)');
  const click = label => evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Unavailable: '+${JSON.stringify(label)}); button.click(); })()`);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (location.origin === ${JSON.stringify(new URL(appUrl).origin)} && !localStorage.getItem('controlled_seeded')) {
      localStorage.setItem('controlled_seeded', 'true'); localStorage.setItem('auth_ok', 'true'); localStorage.setItem('sessionUUID', 'controlled-test');
      const now = new Date(); localStorage.setItem('system_update_reminder_shown_on', [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'));
      localStorage.setItem('npt_session_backup', JSON.stringify({ sessionUUID:'controlled-test', lastUpdated:Date.now(), screen:{name:'stroop'},
        globalTimers:[{id:'recall-route',label:'DCS',startTs:Date.now(),durationMs:3600000,nav:{name:'dcsr',go:'rekog'}}],
        sessionData:{demographics_saved:true,demographics:{patient_initials:'TEST'},stroop_notes:{interferenz_fails:{c1_0:1}},dcsr:{step:'dg',ver:'V1',dg:1,counts:[{richtig:3}]}} }));
    }
  ` }, sessionId);
  await send('Page.navigate', { url: appUrl }, sessionId);
  const failButton = 'document.querySelectorAll(\'button[title="Fehl-Nennung markieren/korrigieren"]\')';
  await until(() => evaluate(`${failButton}.length > 0`), 'Stroop restored');
  await evaluate(`${failButton}[0].click()`);
  await until(async () => (await snapshot()).sessionData.stroop_notes.interferenz_fails.c1_0 === 2, 'corrected error persisted');
  assert.equal(await evaluate(`${failButton}[0].textContent.trim()`), 'F korr.');
  await evaluate(`${failButton}[0].click()`);
  await until(async () => !Object.hasOwn((await snapshot()).sessionData.stroop_notes.interferenz_fails, 'c1_0'), 'error cleared');
  await evaluate(`${failButton}[0].click()`);
  await until(async () => (await snapshot()).sessionData.stroop_notes.interferenz_fails.c1_0 === 1, 'new error');
  await evaluate(`${failButton}[0].click()`);
  await evaluate(`${failButton}[1].click()`);
  await until(async () => Object.keys((await snapshot()).sessionData.stroop_notes.interferenz_fails).length === 2, 'distinct errors');
  const beforeReload = await evaluate('performance.timeOrigin'); await send('Page.reload', {}, sessionId);
  await until(() => evaluate(`performance.timeOrigin !== ${beforeReload} && ${failButton}.length > 0`), 'Stroop reloaded');
  assert.equal(await evaluate(`${failButton}[0].textContent.trim()`), 'F korr.');
  assert.equal((await snapshot()).sessionData.stroop_notes.interferenz_fails.c2_0, 1);
  console.log('PASS: Stroop error/correction/clear cycles, separate cells and reload preserve the controlled scores.');
  await click('Übersicht');
  await evaluate('[...document.querySelectorAll(".tile-btn")].find(b => b.textContent.includes("CERAD plus")).click()');
  await click('Boston Naming Test');
  await until(() => evaluate('[...document.querySelectorAll("main button")].filter(b => b.textContent.trim()==="Richtig").length===15'), 'naming items');
  const namingClick = (index, label) => evaluate(`[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === ${JSON.stringify(label)})[${index}].click()`);
  await namingClick(0, 'Richtig');
  await until(async () => (await snapshot()).sessionData.cerad_benennen?.total === 1, 'naming correct score');
  await namingClick(0, 'Richtig');
  await until(async () => (await snapshot()).sessionData.cerad_benennen.total === 0, 'naming clear');
  assert.equal((await snapshot()).sessionData.cerad_benennen.items[0].correct, null);
  await namingClick(0, 'Falsch');
  await namingClick(1, 'Richtig');
  await evaluate('(() => { const note=document.querySelector("input[aria-label=Notiz]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(note,"Synthetic naming note"); note.dispatchEvent(new Event("input",{bubbles:true})); })()');
  await until(async () => (await snapshot()).sessionData.cerad_benennen.items[0].note === 'Synthetic naming note', 'naming note');
  await click('Zur CERAD-Auswahl'); await click('Boston Naming Test');
  await until(async () => (await snapshot()).sessionData.cerad_benennen.total === 1, 'naming reopened');
  assert.equal((await snapshot()).sessionData.cerad_benennen.items[0].correct, false);
  assert.equal(await evaluate('document.querySelector("input[aria-label=Notiz]").value'), 'Synthetic naming note');
  console.log('PASS: naming toggles, zero score, notes and reopening retain one authoritative persisted result.');
  await click('Übersicht');
  await evaluate('[...document.querySelectorAll(".tile-btn")].find(b => b.textContent.includes("DCS-R")).click()');
  await until(() => evaluate('!!document.querySelector("canvas")'), 'DCS drawing step');
  await until(() => evaluate('[...document.querySelectorAll("main img")].every(img => img.complete && img.naturalWidth > 0)'), 'DCS figure layout');
  const rect = await evaluate('(async () => { const canvas=document.querySelector("canvas"); canvas.scrollIntoView({block:"center"}); await document.fonts.ready; await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); const r=canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
  await send('Input.dispatchMouseEvent', { type:'mousePressed', x:rect.x+rect.width*.2, y:rect.y+rect.height*.3, button:'left', buttons:1, clickCount:1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type:'mouseMoved', x:rect.x+rect.width*.5, y:rect.y+rect.height*.6, button:'left', buttons:1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type:'mouseReleased', x:rect.x+rect.width*.5, y:rect.y+rect.height*.6, button:'left', buttons:0, clickCount:1 }, sessionId);
  await until(async () => !!(await snapshot()).sessionData.dcsr.drawingKeys?.[0], 'DCS draft saved before scoring');
  await evaluate('(() => { const label=[...document.querySelectorAll("div")].find(n=>n.textContent==="Richtig"); label.parentElement.parentElement.querySelector("button").click(); })()');
  await until(async () => (await snapshot()).sessionData.dcsr.counts[0].richtig === 4, 'live DCS score');
  await evaluate('document.querySelector(".reminder-open-button").click()');
  await until(() => evaluate('document.body.textContent.includes("Rekognitionsdurchgang")'), 'recall navigation while mounted');
  assert.equal((await snapshot()).sessionData.dcsr.counts[0].richtig, 4);
  assert.equal((await snapshot()).sessionData.dcsr.step, 'rekog');
  const recallDocument = await evaluate('performance.timeOrigin'); await send('Page.reload', {}, sessionId);
  await until(() => evaluate(`performance.timeOrigin !== ${recallDocument} && document.body.textContent.includes('Rekognitionsdurchgang')`), 'recall route restored');
  assert.equal((await snapshot()).sessionData.dcsr.counts[0].richtig, 4);
  console.log('PASS: DCS reminder navigation and reload enter recall without losing the live trial score.');
  await evaluate('(() => { const original=URL.createObjectURL; URL.createObjectURL=blob=>{if(blob.type.startsWith("text/csv")) window.controlledCsv=blob.text();return original(blob);}; HTMLAnchorElement.prototype.click=function(){}; })()');
  await click('CSV Export');
  await until(() => evaluate('!!window.controlledCsv'), 'controlled scores exported');
  const [headers, values] = (await evaluate('window.controlledCsv')).split('\n').map(line => line.split(';'));
  for (const [key, value] of Object.entries({ stroop_interferenz_errors:1, stroop_interferenz_corrected:1, cerad_bnt_correct:1, dcsr_dg1_hits:4 })) {
    assert.equal(values[headers.indexOf(key)], `"${value}"`, key);
  }
  console.log('PASS: actual CSV export matches Stroop, naming and DCS scores after navigation and reload.');
  assert.deepEqual(errors, [], 'no React render-update errors or browser exceptions');
} finally {
  await send('Target.disposeBrowserContext', { browserContextId }); socket.close();
}
