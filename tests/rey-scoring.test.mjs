import test from "node:test";
import assert from "node:assert/strict";
import { REY_ELEMENTS, REY_VERSIONS, getReyElementScore, getReySummary, getReyExportFields, switchReyVersion } from "../src/lib/rey-scoring.js";

test("blank and explicit zero scores are distinct", () => {
  assert.equal(getReyElementScore({}, 1), null);
  assert.equal(getReyElementScore({ scores: { 1: 0 } }, 1), 0);
  assert.deepEqual(getReySummary({}), { scoredCount: 0, subtotal: 0, complete: false, total: null });
  assert.deepEqual(getReySummary({ scores: { 1: 0 } }), { scoredCount: 1, subtotal: 0, complete: false, total: null });
});

test("both ROCFT versions use identical scoring and export fields", () => {
  const scores = Object.fromEntries(REY_ELEMENTS.map(({ id }) => [id, 2]));
  scores[3] = 0.5;
  const v1 = getReyExportFields({ version: "1", scores, notes: "Observation", duration_s: 150 });
  const v2 = getReyExportFields({ version: "2", scores, notes: "Observation", duration_s: 150 });
  assert.deepEqual({ ...v1, rey_copy_version: "2" }, v2);
  assert.equal(v2.rey_copy_total, 34.5);
  assert.equal(v2.rey_copy_completed, 1);
  for (const version of REY_VERSIONS) {
    assert.deepEqual(version.elements.map(({ id }) => id), Array.from({ length: 18 }, (_, index) => index + 1));
  }
});

test("paper scoring-sheet landmarks retain their IDs for Form A and Form B", () => {
  // Independent reference IDs read from the user's supplied scoring sheets.
  const landmarks = [
    ["1", [[1, "Kreuz"], [2, "Rechteck"], [6, "Kleines Rechteck"], [8, "Vier parallele Linien"], [11, "Kreis mit drei Punkten"], [12, "Fünf Querstriche"], [14, "Raute"], [17, "Kreuz unter"], [18, "Quadrat"]]],
    ["2", [[1, "Pfeil links"], [3, "Großes Quadrat"], [7, "Diagonalkreuz"], [8, "Kleines Quadrat"], [9, "Kreis"], [10, "Rechteck"], [11, "Diagonaler Pfeil"], [12, "Halbkreis"], [13, "Dreieck rechts"], [14, "sieben Punkten"], [15, "6. und 7. Punkt"], [16, "Dreieck unterhalb"], [17, "drei Querstrichen"], [18, "Stern"]]],
  ];
  for (const [id, references] of landmarks) {
    const version = REY_VERSIONS.find((entry) => entry.id === id);
    for (const [elementId, description] of references) {
      assert.ok(version.elements.find((element) => element.id === elementId).label.includes(description), `Form ${id}, element ${elementId}: ${description}`);
    }
  }
});

test("changing figure preserves drafts without moving scores to different elements", () => {
  const legacy = { scores: { 1: 2, 11: 0.5 }, notes: "First figure", duration_s: 120 };
  const abort = { reason: "Patientenwunsch", note: "Pause", at: 1 };
  const v2 = switchReyVersion(legacy, "2", abort);
  assert.equal(v2.data.version, "2");
  assert.deepEqual(v2.data.scores, {});
  assert.equal(v2.data.notes, "");
  assert.equal(v2.aborted, null);
  const editedV2 = { ...v2.data, scores: { 1: 1 }, notes: "Second figure" };
  const restored = switchReyVersion(editedV2, "1");
  assert.deepEqual(restored.data.scores, legacy.scores);
  assert.equal(restored.data.notes, legacy.notes);
  assert.equal(restored.data.duration_s, 120);
  assert.deepEqual(restored.aborted, abort);
  const restoredV2 = switchReyVersion(restored.data, "2", restored.aborted);
  assert.deepEqual(restoredV2.data.scores, { 1: 1 });
  assert.equal(restoredV2.data.notes, "Second figure");
  assert.equal(restoredV2.aborted, null);
});

test("18 valid scores are required before a final raw total is available", () => {
  const scores = Object.fromEntries(REY_ELEMENTS.map(({ id }) => [id, 2]));
  assert.deepEqual(getReySummary({ scores }), { scoredCount: 18, subtotal: 36, complete: true, total: 36 });
  scores[1] = 0.5;
  scores[2] = 0;
  assert.equal(getReySummary({ scores }).total, 32.5);
  scores[18] = null;
  assert.deepEqual(getReySummary({ scores }), { scoredCount: 17, subtotal: 30.5, complete: false, total: null });
});

test("invalid persisted values and unknown elements do not enter the score", () => {
  const scores = { 1: "2", 2: NaN, 3: 1.5, 4: -1, 5: 3, 6: null, 7: 1, 99: 2 };
  assert.deepEqual(getReySummary({ scores }), { scoredCount: 1, subtotal: 1, complete: false, total: null });
});

test("export preserves blanks, fractional scores, zero duration, notes and abort details", () => {
  const blank = getReyExportFields();
  assert.equal(blank.rey_copy_total, null);
  assert.equal(blank.rey_copy_completed, null);
  const partial = getReyExportFields({ scores: { 1: 0.5, 2: 0 }, duration_s: 0, notes: "Detail-first" });
  assert.equal(partial.rey_copy_element_1, 0.5);
  assert.equal(partial.rey_copy_element_2, 0);
  assert.equal(partial.rey_copy_element_3, null);
  assert.equal(partial.rey_copy_total, null);
  assert.equal(partial.rey_copy_subtotal, 0.5);
  assert.equal(partial.rey_copy_completed, 0);
  assert.equal(partial.rey_copy_duration_s, 0);
  assert.equal(partial.rey_copy_notes, "Detail-first");
  const zero = { scores: Object.fromEntries(REY_ELEMENTS.map(({ id }) => [id, 0])) };
  assert.equal(getReyExportFields(zero).rey_copy_total, 0);
  assert.equal(getReyExportFields(zero).rey_copy_completed, 1);
  const aborted = getReyExportFields(zero, { reason: "Patientenwunsch", note: "Stopped" });
  assert.equal(aborted.rey_copy_aborted, 1);
  assert.equal(aborted.rey_copy_completed, 0);
  assert.equal(aborted.rey_copy_abort_reason, "Patientenwunsch");
  assert.equal(aborted.rey_copy_abort_note, "Stopped");
});
