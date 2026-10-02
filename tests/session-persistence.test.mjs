import assert from "node:assert/strict";
import test from "node:test";
import { createSessionPersistence } from "../src/lib/session-persistence.js";

const state = () => ({ screen: { name: "menu" }, globalTimers: [], activePipeline: null, pipelineInterruption: null, sessionData: {}, sessionUUID: "TEST" });

test("immediate backup, debounce and repeated lifecycle flushes reuse one snapshot/write", async () => {
  const backups = [], saves = [];
  const persistence = createSessionPersistence({ writeBackup: (s) => backups.push(s), writeSession: (id, s) => saves.push([id, s]), now: () => 123 });
  const first = state();
  const snapshot = persistence.backup(first);
  assert.equal(backups.length, 1); // Synchronous recovery backup, before awaiting anything.
  await Promise.all([persistence.flush(first), persistence.flush({ ...first }), persistence.flush(first)]);
  assert.equal(backups.length, 1);
  assert.equal(saves.length, 1);
  assert.equal(saves[0][1], snapshot);
  assert.equal(snapshot.lastUpdated, 123);
});

test("real changes are backed up immediately; only the latest debounced state need be flushed", async () => {
  const backups = [], saves = [];
  const persistence = createSessionPersistence({ writeBackup: (s) => backups.push(s), writeSession: (id, s) => saves.push([id, s]) });
  const first = state();
  persistence.backup(first);
  const second = { ...first, sessionData: { value: 0 } };
  persistence.backup(second);
  const third = { ...second, screen: { name: "vlmt" }, sessionData: { value: 1 } };
  persistence.backup(third);
  assert.equal(backups.length, 3);
  await persistence.flush(third);
  assert.equal(saves.length, 1);
  assert.equal(saves[0][1].sessionData.value, 1);
  assert.equal(backups.length, 3);
});

test("flush includes a pending change immediately and preserves zeros, notes and schema", async () => {
  const backups = [], saves = [];
  const persistence = createSessionPersistence({ writeBackup: (s) => backups.push(JSON.stringify(s)), writeSession: (id, s) => saves.push(s) });
  const current = { ...state(), sessionData: { qolie31: { responses: { 1: 0, 31: null } }, notes: "TEST", tmt_a: 0 } };
  const pending = persistence.flush(current);
  assert.deepEqual(JSON.parse(backups[0]).sessionData, current.sessionData);
  await pending;
  assert.deepEqual(saves[0].sessionData, current.sessionData);
  assert.deepEqual(Object.keys(saves[0]).sort(), [...Object.keys(current), "lastUpdated"].sort());
});

test("database writes remain ordered when the first asynchronous write is slow", async () => {
  const saves = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const persistence = createSessionPersistence({ writeBackup: () => {}, writeSession: async (id, s) => { if (!saves.length) await gate; saves.push(s.sessionData.value); } });
  const first = { ...state(), sessionData: { value: 1 } };
  const a = persistence.flush(first);
  const b = persistence.flush({ ...first, sessionData: { value: 2 } });
  await Promise.resolve();
  assert.deepEqual(saves, []);
  release();
  await Promise.all([a, b]);
  assert.deepEqual(saves, [1, 2]);
});

test("failed backup is retryable and does not prevent the independent database save", async () => {
  let backupCalls = 0;
  const saves = [], errors = [];
  const persistence = createSessionPersistence({
    writeBackup: () => { if (++backupCalls === 1) throw new Error("quota"); },
    writeSession: (id, s) => saves.push(s), onError: (error) => errors.push(error.message),
  });
  const current = state();
  persistence.backup(current);
  await persistence.flush(current);
  assert.equal(backupCalls, 2);
  assert.equal(saves.length, 1);
  assert.deepEqual(errors, ["quota"]);
});

test("failed database save can be retried without serializing the backup again", async () => {
  let backups = 0, attempts = 0;
  const errors = [];
  const persistence = createSessionPersistence({ writeBackup: () => backups++, writeSession: () => { if (++attempts === 1) throw new Error("database"); }, onError: (error) => errors.push(error.message) });
  const current = state();
  await persistence.flush(current);
  await persistence.flush(current);
  assert.equal(backups, 1);
  assert.equal(attempts, 2);
  assert.deepEqual(errors, ["database"]);
});

test("new sessions cannot reuse a previous session's snapshot", async () => {
  const saves = [];
  const persistence = createSessionPersistence({ writeBackup: () => {}, writeSession: (id, s) => saves.push([id, s.sessionData]) });
  const first = { ...state(), sessionData: { value: 1 } };
  await persistence.flush(first);
  await persistence.flush({ ...first, sessionUUID: "NEW", sessionData: {} });
  assert.deepEqual(saves, [["TEST", { value: 1 }], ["NEW", {}]]);
});
