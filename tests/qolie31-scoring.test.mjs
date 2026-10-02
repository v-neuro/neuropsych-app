import test from "node:test";
import assert from "node:assert/strict";
import { QOLIE31_ITEM_RULES, QOLIE31_SUBSCALES, QOLIE31_SCORING_VERSION, QOLIE31_OVERALL_POLICY, transformQolie31Item, calculateQolie31, getQolie31Assessment, getQolie31ExportFields } from "../src/lib/qolie31-scoring.js";
import { QOLIE31_BLOCKS, QOLIE31_EXAMINER_BLOCKS, QOLIE31_INSTRUCTIONS } from "../src/lib/qolie31-content.js";

// Independent fixtures transcribed from the supplied manual's Table 2.
const mappingGroups = [
  [[2, 5, 6, 9], [100, 80, 60, 40, 20, 0]],
  [[3, 4, 7, 8, 10, 11, 12, 13, 16, 17, 18], [0, 20, 40, 60, 80, 100]],
  [[14, 25, 26, 27, 28, 29, 30], [100, 75, 50, 25, 0]],
  [[15, 21, 23, 24], [0, 33.3, 66.7, 100]],
  [[19, 20], [0, 25, 50, 75, 100]],
  [[22], [0, 50, 100]],
];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);
function endpointFixture(best) {
  const responses = { 1: best ? 10 : 0, 31: best ? 100 : 0 };
  for (const [ids, scores] of mappingGroups) {
    for (const id of ids) responses[id] = scores.indexOf(best ? 100 : 0) + 1;
  }
  return responses;
}
const ones = () => Object.fromEntries(Array.from({ length: 30 }, (_, index) => [index + 1, 1]));

test("every valid response mapping for all 31 canonical items, including zeros", () => {
  assert.deepEqual(Object.keys(QOLIE31_ITEM_RULES).map(Number), Array.from({ length: 31 }, (_, index) => index + 1));
  for (let raw = 0; raw <= 10; raw++) assert.equal(transformQolie31Item(1, raw), raw * 10);
  for (const [ids, expected] of mappingGroups) {
    for (const id of ids) expected.forEach((score, index) => assert.equal(transformQolie31Item(id, index + 1), score, `Item ${id}, raw ${index + 1}`));
  }
  for (let raw = 0; raw <= 100; raw++) {
    assert.equal(transformQolie31Item(31, raw), raw);
    assert.equal(calculateQolie31({ 31: raw }).items[31].score, null);
  }
  assert.equal(transformQolie31Item(31, 42.5), 42.5);
});

test("best/worst fixtures select response codes according to each scoring direction", () => {
  for (const best of [true, false]) {
    const result = calculateQolie31(endpointFixture(best));
    assert.deepEqual(result.errors, {});
    for (const { key } of QOLIE31_SUBSCALES) assert.equal(result.subscales[key].score, best ? 100 : 0);
    assert.equal(result.overall, best ? 100 : 0);
    assert.equal(result.scoredAnsweredCount, 30);
    assert.equal(result.complete, true);
    assert.equal(result.health, best ? 100 : 0);
  }
});

test("raw code 1 on every scored item reproduces the independent mixed fixture", () => {
  const result = calculateQolie31(ones());
  const expected = {
    seizure_worry: 20, overall_quality_of_life: 55, emotional_well_being: 40,
    energy_fatigue: 50, cognitive_functioning: 100 / 6, medication_effects: 200 / 3, social_functioning: 40,
  };
  for (const [key, score] of Object.entries(expected)) close(result.subscales[key].score, score);
  close(result.overall, 36.2);
  assert.equal(result.scoredComplete, true);
  assert.equal(result.healthAnswered, false);
  assert.equal(result.complete, false);
});

test("German block/row order maps explicitly to canonical items 1–31", () => {
  const ids = [[1], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], [14], [15], [16], [17, 18], [19, 20], [21, 22, 23, 24], [25, 26, 27, 28, 29, 30], [31]];
  assert.deepEqual(QOLIE31_BLOCKS.map(({ number }) => number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(QOLIE31_BLOCKS.map(({ items }) => items.map(({ id }) => id)), ids);
  assert.deepEqual(QOLIE31_BLOCKS[1].items.map(({ text }) => text), [
    "... waren Sie voller Schwung?", "... waren Sie sehr nervös?", "... waren Sie so niedergeschlagen, daß Sie nichts aufheitern konnte?",
    "... waren Sie ruhig und gelassen?", "... waren Sie voller Energie?", "... waren Sie entmutigt und traurig?",
    "... waren Sie erschöpft?", "... waren Sie glücklich?", "... waren Sie müde?", "... waren Sie in Sorge, einen weiteren Anfall zu erleiden?",
    "... hatten Sie Schwierigkeiten beim Nachdenken und dem Lösen von Problemen (z.B. beim Pläne machen, Entscheidungen treffen, dem Lernen von neuen Dingen)?",
    "... waren Sie durch Ihren Gesundheitszustand in Ihren sozialen Kontakten und Unternehmungen eingeschränkt (wie Besuche bei Freunden oder nahen Verwandten)?",
  ]);
  assert.deepEqual(QOLIE31_BLOCKS[8].items.map(({ text }) => text), ["Anfälle", "Gedächtnisprobleme", "Beeinträchtigungen im Arbeitsleben", "Beeinträchtigungen im sozialen Leben", "Körperliche Auswirkungen der antiepileptischen Medikamente", "Psychische Auswirkungen der antiepileptischen Medikamente"]);
  for (const block of QOLIE31_BLOCKS) {
    for (const item of block.items.filter(({ healthRating }) => !healthRating)) {
      assert.deepEqual(item.options.map(({ value }) => value).sort((a, b) => a - b), Object.keys(QOLIE31_ITEM_RULES[item.id].responseScores).map(Number));
    }
  }
  assert.equal(QOLIE31_BLOCKS[7].items[1].options.length, 3);
  assert.deepEqual(QOLIE31_BLOCKS[8].items[0].options.map(({ label }) => label), ["leide überhaupt nicht darunter", "", "", "", "leide ausgesprochen darunter"]);
  assert.ok(QOLIE31_INSTRUCTIONS[0].includes("die entsprechende Zahl (1,2,3,...) ankreuzen"));
});

test("subscales cover precisely the 30 scored items once with the manual's weights", () => {
  assert.deepEqual(QOLIE31_SUBSCALES.map(({ items, weight }) => [items, weight]), [
    [[11, 21, 22, 23, 25], 0.08], [[1, 14], 0.14], [[3, 4, 5, 7, 9], 0.15], [[2, 6, 8, 10], 0.12],
    [[12, 15, 16, 17, 18, 26], 0.27], [[24, 29, 30], 0.03], [[13, 19, 20, 27, 28], 0.21],
  ]);
  assert.deepEqual(QOLIE31_SUBSCALES.flatMap(({ items }) => items).sort((a, b) => a - b), Array.from({ length: 30 }, (_, index) => index + 1));
  close(QOLIE31_SUBSCALES.reduce((sum, { weight }) => sum + weight, 0), 1);
});

test("compact examiner presentation retains canonical IDs, options and time frames", () => {
  for (const [index, block] of QOLIE31_EXAMINER_BLOCKS.entries()) {
    const source = QOLIE31_BLOCKS[index];
    assert.equal(block.number, source.number);
    assert.deepEqual(block.items.map(({ id }) => id), source.items.map(({ id }) => id));
    assert.deepEqual(block.items.map(({ options }) => options?.map(({ value }) => value)), source.items.map(({ options }) => options?.map(({ value }) => value)));
    if (block.number !== 1) assert.deepEqual(block.items.map(({ options }) => options), source.items.map(({ options }) => options));
    assert.equal(block.instruction, undefined);
    if ([2, 3, 4, 5, 6, 7].includes(block.number)) assert.ok(block.title.includes("4 Wochen"));
  }
  for (const id of [21, 23]) {
    assert.ok(QOLIE31_EXAMINER_BLOCKS[7].items.find((item) => item.id === id).text.includes("nächste 4 Wochen"));
  }
  assert.ok(QOLIE31_EXAMINER_BLOCKS[9].title.includes("einschließlich Epilepsie"));
  assert.equal(QOLIE31_EXAMINER_BLOCKS[0].items[0].options.find(({ value }) => value === 0).label, "Lebensqualität könnte nicht schlechter sein");
});

test("missing item 11 uses four actual answers, not the full five-item divisor", () => {
  const result = calculateQolie31({ 21: 4, 22: 3, 23: 4, 25: 1 });
  assert.deepEqual(result.subscales.seizure_worry, { score: 100, answeredCount: 4, itemCount: 5, complete: false });
  assert.equal(result.scoredAnsweredCount, 4);
});

test("one answered item per subscale allows a clearly partial overall, without reweighting", () => {
  const result = calculateQolie31({ 11: 6, 1: 10, 3: 6, 2: 1, 12: 6, 24: 4, 13: 6 });
  assert.equal(result.overall, 100);
  assert.equal(result.scoredAnsweredCount, 7);
  assert.equal(result.scoredComplete, false);
  assert.ok(Object.values(result.subscales).every(({ score, answeredCount, complete }) => score === 100 && answeredCount === 1 && !complete));
});

test("entirely missing subscale prevents overall score; blanks return unavailable not zero/NaN", () => {
  const blank = calculateQolie31({});
  assert.equal(blank.overall, null);
  assert.ok(Object.values(blank.subscales).every(({ score, answeredCount }) => score === null && answeredCount === 0));
  for (const { key, items } of QOLIE31_SUBSCALES) {
    const responses = endpointFixture(true);
    items.forEach((id) => { delete responses[id]; });
    const result = calculateQolie31(responses);
    assert.equal(result.subscales[key].score, null);
    assert.equal(result.overall, null);
  }
});

test("missing values are distinct from valid zero answers and invalid raw values are rejected", () => {
  for (const raw of [undefined, null]) {
    assert.equal(transformQolie31Item(1, raw), null);
    assert.equal(transformQolie31Item(31, raw), null);
  }
  const zero = calculateQolie31({ 1: 0, 31: 0 });
  assert.equal(zero.items[1].score, 0);
  assert.equal(zero.subscales.overall_quality_of_life.score, 0);
  assert.equal(zero.health, 0);
  assert.equal(zero.scoredAnsweredCount, 1);
  assert.equal(zero.healthAnswered, true);
  for (const id of Object.keys(QOLIE31_ITEM_RULES).map(Number)) {
    for (const raw of [-1, 101, NaN, Infinity, "1", "", true, {}, []]) {
      assert.throws(() => transformQolie31Item(id, raw), RangeError);
      assert.ok(calculateQolie31({ [id]: raw }).errors[id]);
    }
    if (id !== 31) assert.throws(() => transformQolie31Item(id, 1.5), RangeError);
  }
  for (const id of [2, 14, 15, 19, 22]) {
    const max = Math.max(...Object.keys(QOLIE31_ITEM_RULES[id].responseScores).map(Number));
    assert.throws(() => transformQolie31Item(id, 0), RangeError);
    assert.throws(() => transformQolie31Item(id, max + 1), RangeError);
  }
  assert.throws(() => transformQolie31Item(99, 1), RangeError);
  assert.ok(calculateQolie31({ 99: 1 }).errors[99]);
  assert.ok(calculateQolie31([]).errors.responses);
  const invalid = calculateQolie31({ ...endpointFixture(true), 21: 5 });
  assert.equal(invalid.subscales.seizure_worry.score, null);
  assert.equal(invalid.overall, null);
  assert.equal(invalid.items[21].raw, 5);
});

test("item 31 cannot affect any subscale/overall; its completion is separate", () => {
  const responses = ones();
  const reference = calculateQolie31(responses);
  for (const health of [null, 0, 50, 100, 150]) {
    const result = calculateQolie31({ ...responses, 31: health });
    assert.deepEqual(result.subscales, reference.subscales);
    assert.equal(result.overall, reference.overall);
    assert.equal(result.scoredComplete, true);
  }
});

test("overall uses unrounded subscales and the published 33.3/66.7 values", () => {
  const responses = { ...ones(), 15: 2, 21: 3, 24: 2 };
  const result = calculateQolie31(responses);
  close(result.subscales.cognitive_functioning.score, 133.3 / 6);
  close(result.subscales.seizure_worry.score, 166.7 / 5);
  close(result.subscales.medication_effects.score, 233.3 / 3);
  const expected = 0.08 * (166.7 / 5) + 0.14 * 55 + 0.15 * 40 + 0.12 * 50 + 0.27 * (133.3 / 6) + 0.03 * (233.3 / 3) + 0.21 * 40;
  close(result.overall, expected);
  const rounded = QOLIE31_SUBSCALES.reduce((sum, { key, weight }) => sum + Math.round(result.subscales[key].score * 10) / 10 * weight, 0);
  assert.notEqual(result.overall, rounded);
});

test("exports recompute from raw answers, preserve blanks/zeros, precision and version", () => {
  const responses = Object.freeze({ ...ones(), 31: 0 });
  const data = Object.freeze({ responses, scoring_version: QOLIE31_SCORING_VERSION, notes: "Fixture" });
  const fields = getQolie31ExportFields(data);
  assert.equal(fields.qolie31_item_1_raw, 1);
  assert.equal(fields.qolie31_item_1_score, 10);
  assert.equal(fields.qolie31_item_31_raw, 0);
  assert.equal(fields.qolie31_general_health, 0);
  assert.equal(fields.qolie31_cognitive_functioning, 100 / 6);
  close(fields.qolie31_overall, 36.2);
  assert.equal(fields.qolie31_completed, 1);
  assert.equal(fields.qolie31_scoring_version, QOLIE31_SCORING_VERSION);
  assert.equal(fields.qolie31_overall_policy, QOLIE31_OVERALL_POLICY);
  const blank = getQolie31ExportFields();
  assert.equal(blank.qolie31_item_1_raw, null);
  assert.equal(blank.qolie31_item_31_raw, null);
  assert.equal(blank.qolie31_overall, null);
  assert.equal(blank.qolie31_completed, null);
  const partial = getQolie31ExportFields({ responses: { 1: 0 } });
  assert.equal(partial.qolie31_item_1_raw, 0);
  assert.equal(partial.qolie31_overall_quality_of_life, 0);
  assert.equal(partial.qolie31_scored_answered_count, 1);
  assert.equal(partial.qolie31_health_answered, 0);
  const aborted = getQolie31ExportFields(data, { reason: "Patientenwunsch", note: "Pause" });
  assert.equal(aborted.qolie31_completed, 0);
  assert.equal(aborted.qolie31_overall, fields.qolie31_overall);
  assert.equal(aborted.qolie31_abort_reason, "Patientenwunsch");
  assert.equal(aborted.qolie31_abort_note, "Pause");
});

test("unsupported scoring version and invalid responses are visible, never silently rescored", () => {
  const data = { responses: ones(), scoring_version: "future-version" };
  const result = getQolie31Assessment(data);
  assert.ok(result.errors.scoring_version);
  assert.equal(result.overall, null);
  assert.ok(Object.values(result.subscales).every(({ score }) => score === null));
  const fields = getQolie31ExportFields(data);
  assert.equal(fields.qolie31_scoring_version, "future-version");
  assert.equal(fields.qolie31_item_1_score, null);
  assert.equal(fields.qolie31_item_1_raw, 1);
  assert.ok(fields.qolie31_validation_errors.includes("future-version"));
  const invalid = getQolie31ExportFields({ responses: { 1: -1 } });
  assert.equal(invalid.qolie31_item_1_raw, -1);
  assert.equal(invalid.qolie31_item_1_score, null);
  assert.ok(invalid.qolie31_validation_errors.includes("Item 1"));
});
