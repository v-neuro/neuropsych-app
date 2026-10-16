import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssessmentBackup, parseAssessmentBackup } from '../src/lib/assessment-backup.js';

const fixture = () => ({
  sessionUUID: 'backup-test', screen: { name: 'dcsr', go: 'rekog' },
  globalTimers: [{ id: 'reminder', label: 'DCS', startTs: 1234, durationMs: 1800000 }],
  activePipeline: { index: 1, steps: [{ key: 'vlmt', route: { name: 'vlmt' } }, { key: 'dcsr', route: { name: 'dcsr' } }] },
  pipelineInterruption: { key: 'vlmt', stepIndex: 0 },
  sessionData: {
    demographics_saved: true, demographics: { patient_initials: 'TEST', education_years: 11.5, education_years_manual: true },
    dcsr: { dg: 2, counts: [{ richtig: 0 }], drawingKeys: ['backup-test:dcsr:dg1'], drawingGalleryKeys: [[{ key: 'backup-test:dcsr:fig1', rating: 'R' }]] },
    qolie31: { responses: { 1: 0, 31: null } }, notes: '<script>test</script> & äöü',
  },
});
const drawings = () => [
  { key: 'backup-test:dcsr:dg1', value: new Blob([new Uint8Array([0, 255, 128, 1])], { type: 'image/png' }) },
  { key: 'backup-test:dcsr:fig1', value: 'data:image/png;base64,AP+A' },
];
async function resign(backup) {
  const { format, schemaVersion, createdAt, appVersion, snapshot, drawings: images } = backup;
  const data = { format, schemaVersion, createdAt, appVersion, snapshot, drawings: images };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  backup.checksum = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return JSON.stringify(backup);
}

test('full backup round-trips scores, missing values, drawings, routes, timers and pipeline progress', async () => {
  const snapshot = fixture();
  const json = await createAssessmentBackup(snapshot, drawings());
  const restored = await parseAssessmentBackup(json);
  assert.deepEqual(restored.snapshot, snapshot);
  assert.equal(restored.drawings[0].value.type, 'image/png');
  assert.deepEqual([...new Uint8Array(await restored.drawings[0].value.arrayBuffer())], [0, 255, 128, 1]);
  assert.equal(restored.drawings[1].value, drawings()[1].value);
});

test('damaged score or drawing data is rejected before restore', async () => {
  const json = await createAssessmentBackup(fixture(), drawings());
  for (const change of [b => { b.snapshot.sessionData.dcsr.counts[0].richtig = 9; }, b => { b.drawings[0].data = 'AAAA'; }]) {
    const changed = JSON.parse(json); change(changed);
    await assert.rejects(parseAssessmentBackup(JSON.stringify(changed)), /beschädigt/);
  }
});

test('CSV, malformed files and unsupported backup versions are rejected', async () => {
  await assert.rejects(parseAssessmentBackup('key;value'), /lesbares Backup/);
  await assert.rejects(parseAssessmentBackup('{}'), /kein vollständiges/);
  const backup = JSON.parse(await createAssessmentBackup(fixture(), drawings()));
  backup.schemaVersion = 2;
  await assert.rejects(parseAssessmentBackup(JSON.stringify(backup)), /Version/);
});

test('missing gallery figures, duplicate keys, foreign-session drawings and unsafe JSON keys are rejected', async () => {
  const json = await createAssessmentBackup(fixture(), drawings());
  for (const change of [
    b => { b.drawings.pop(); },
    b => { b.drawings.push(b.drawings[0]); },
    b => { b.drawings[0].key = 'other:dcsr:dg1'; },
    b => { b.snapshot.sessionData = JSON.parse('{"__proto__":{"polluted":true}}'); },
  ]) {
    const backup = JSON.parse(json); change(backup);
    await assert.rejects(parseAssessmentBackup(await resign(backup)));
  }
  assert.equal({}.polluted, undefined);
});

test('deleted/cleared current canvas keys are allowed; saved gallery figures must exist', async () => {
  const snapshot = fixture();
  const json = await createAssessmentBackup(snapshot, drawings().slice(1));
  assert.equal((await parseAssessmentBackup(json)).drawings.length, 1);
});

test('invalid timer and pipeline state cannot be imported', async () => {
  const json = await createAssessmentBackup(fixture(), drawings());
  for (const change of [b => { b.snapshot.globalTimers[0].durationMs = -1; }, b => { b.snapshot.activePipeline.index = 5; }]) {
    const backup = JSON.parse(json); change(backup);
    await assert.rejects(parseAssessmentBackup(await resign(backup)));
  }
});

test('legacy embedded drawing blobs are preserved as raster data URLs', async () => {
  const snapshot = fixture();
  snapshot.sessionData.dcsr.drawings = [new Blob([new Uint8Array([0, 255, 128])], { type: 'image/png' })];
  const backup = await parseAssessmentBackup(await createAssessmentBackup(snapshot, drawings()));
  assert.equal(backup.snapshot.sessionData.dcsr.drawings[0], 'data:image/png;base64,AP+A');
});
