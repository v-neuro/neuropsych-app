import test from "node:test";
import assert from "node:assert/strict";
import { appendExportContract, normalizeAssessmentResults } from "../src/lib/export-contract.js";
import { getReyExportFields } from "../src/lib/rey-scoring.js";
import { getQolie31ExportFields } from "../src/lib/qolie31-scoring.js";
import { csvCell } from "../src/lib/export-safety.js";

test("untouched new tests are not-performed; historical absence stays unknown", () => {
  for (const [session, expected] of [[{ collection_version: 2 }, "not-performed"], [{}, "unknown"]]) {
    const row = appendExportContract({ tmt_a_s: null, tmt_a_aborted: 0 }, session);
    assert.equal(row.export_schema_version, "2");
    assert.equal(row.tmt_a_s_missing_reason, expected);
    assert.equal(row.tmt_assessment_status, expected);
    assert.equal(row.tmt_a_aborted_missing_reason, "");
  }
});

test("zero, false, fractions and notes survive; reasons never replace numeric fields", () => {
  const row = appendExportContract({ tmt_a_s: 0, tmt_b_s: null, notes_tmt_a: "Observed", tmt_a_aborted: false, rey_copy_element_1: 0.5 }, { collection_version: 2, tmt_a: 0 });
  assert.equal(row.tmt_a_s, 0);
  assert.equal(row.tmt_a_s_missing_reason, "");
  assert.equal(row.tmt_b_s_missing_reason, "unknown");
  assert.equal(row.tmt_assessment_status, "recorded");
  assert.equal(row.notes_tmt_a_missing_reason, "");
  assert.equal(row.tmt_a_aborted_missing_reason, "");
  assert.equal(row.rey_copy_element_1, 0.5);
  assert.equal(csvCell(row.tmt_b_s), "");
});

test("existing columns remain a prefix and all get a companion reason", () => {
  const original = { session_uuid: "synthetic", demographics_patient_age: "", tmt_a_s: null };
  const keys = Object.keys(original);
  const row = appendExportContract({ ...original }, { collection_version: 2 });
  assert.deepEqual(Object.keys(row).slice(0, keys.length), keys);
  for (const key of keys) assert.ok(Object.hasOwn(row, `${key}_missing_reason`));
});

test("version selection and note-only drafts cannot establish unperformed or scored tests", () => {
  const row = appendExportContract({ ace_total: null, ace_notes: "Could not finish" }, { collection_version: 2, ace: { version: "A", notes: "Could not finish" } });
  assert.equal(row.ace_total_missing_reason, "unknown");
  assert.equal(row.ace_assessment_status, "unknown");
});

test("VLMT requires every prerequisite for the sum and loss, preserving performed zeros", () => {
  const session = { vlmt: { list: "A", step: "score", dg: 2, results: [{ sel: {} }] } };
  const partial = normalizeAssessmentResults({}, session);
  assert.equal(partial.vlmt_sum_dg1_5, null);
  assert.equal(partial.vlmt_dg5_hits, null);
  assert.equal(partial.vlmt_rekog_correct_minus_fp, null);
  session.vlmt = { step: "waiting", results: Array.from({ length: 7 }, () => ({ sel: {} })) };
  const waiting = normalizeAssessmentResults({}, session);
  assert.equal(waiting.vlmt_sum_dg1_5, 0);
  assert.equal(waiting.vlmt_dg6_hits, 0);
  assert.equal(waiting.vlmt_dg7_hits, null);
  assert.equal(waiting.vlmt_loss_dg5_to_dg7, null);
  session.vlmt.results[6].assessed = true;
  session.vlmt.rekog = { assessed: true };
  // Original builder calculated the confirmed recognition value.
  const complete = normalizeAssessmentResults({ vlmt_rekog_correct_minus_fp: 0 }, session);
  assert.equal(complete.vlmt_loss_dg5_to_dg7, 0);
  assert.equal(complete.vlmt_rekog_correct_minus_fp, 0);
});

test("DCS-R partial trials do not become a five-trial total; confirmed zeros survive", () => {
  const session = { dcsr: { dg: 2, step: "dg", counts: [{ richtig: 0 }], rekog: { responses: { korrekt: 0, falsch: 0 } } } };
  const partial = normalizeAssessmentResults({}, session);
  assert.equal(partial.dcsr_dg1_hits, 0);
  assert.equal(partial.dcsr_sum_dg1_5, null);
  assert.equal(partial.dcsr_rekog_correct, null);
  session.dcsr.step = "waiting"; session.dcsr.dg = 5;
  session.dcsr.rekog.assessed = true;
  const complete = normalizeAssessmentResults({}, session);
  assert.equal(complete.dcsr_sum_dg1_5, 0);
  assert.equal(complete.dcsr_rekog_correct, 0);
  assert.equal(complete.dcsr_rekog_wrong, 0);
});

test("CERAD recall, naming and recognition do not fill unassessed parts with zero", () => {
  const row = normalizeAssessmentResults({ cerad_bnt_correct: 0, cerad_wl_recog_correct_no: 0 }, {
    cerad_wl: { dg1: { marks: {}, assessed: true } },
    cerad_benennen: { items: Array.from({ length: 15 }, () => ({ correct: null })) },
  });
  assert.equal(row.cerad_wl_dg1_hits, 0);
  assert.equal(row.cerad_wl_dg1_intrusions, 0);
  assert.equal(row.cerad_wl_dg2_hits, null);
  assert.equal(row.cerad_wl_recog_correct_no, null);
  assert.equal(row.cerad_bnt_correct, null);
});

test("ACE and MoCA export only explicit item scores and complete totals", () => {
  const sections = [{ key: "attention", items: [{ key: "one", max: 2 }, { key: "two", max: 2 }] }];
  const session = { ace: { scores: { one: 0 } }, moca: { scores: { one: 1 } } };
  const options = { aceSections: sections, mocaSections: sections };
  const partial = normalizeAssessmentResults({}, session, options);
  assert.equal(partial.ace_attention_one, 0);
  assert.equal(partial.ace_attention_two, null);
  assert.equal(partial.ace_total, null);
  assert.equal(partial.moca_raw_total, null);
  session.ace.scores.two = 2; session.moca.scores.two = 0;
  const complete = normalizeAssessmentResults({}, session, options);
  assert.equal(complete.ace_total, 2);
  assert.equal(complete.moca_total, 1);
});

test("MMST checkbox total requires confirmation or complete explicit responses", () => {
  const options = { mmstTotal: () => 0 };
  assert.equal(normalizeAssessmentResults({ cerad_mmst_total: 0 }, { cerad_mmst: { items: { zeit: { Jahr: 0 } } } }, options).cerad_mmst_total, null);
  assert.equal(normalizeAssessmentResults({}, { cerad_mmst: { assessment_complete: true } }, options).cerad_mmst_total, 0);
});

test("interference errors and span sums cannot come from a different or untouched part", () => {
  const row = normalizeAssessmentResults({ stroop_interferenz_errors: 0, zahl_fwd_correct_sum: 0 }, { stroop: { woerter: 1000 }, zahl_fwd: { vals: [{}] } });
  assert.equal(row.stroop_interferenz_errors, null);
  assert.equal(row.zahl_fwd_correct_sum, null);
  assert.equal(row.moca_learning_trial_1, null);
});

test("abort caps are missing measured times, while abort status is retained", () => {
  const session = { tmt_a: 180000, tmt_a_aborted: { reason: "Stopped" } };
  const row = appendExportContract(normalizeAssessmentResults({ tmt_a_s: 180 }, session), session);
  assert.equal(row.tmt_a_s, null);
  assert.equal(row.tmt_a_s_missing_reason, "unknown");
  assert.equal(row.tmt_assessment_status, "aborted");
});

test("manual questionnaires distinguish unused item fields from unavailable totals", () => {
  const row = appendExportContract({ phq9_entry_mode: "manual", phq9_item_1: null, phq9_manual_total: 0, phq9_total: 0, phq9_completed: 1, moca_education_correction: "" }, { phq9: { entry_mode: "manual", manual_total: 0 } });
  assert.equal(row.phq9_item_1_missing_reason, "not-applicable");
  assert.equal(row.phq9_total_missing_reason, "");
  assert.equal(row.phq9_assessment_status, "completed");
  assert.equal(row.moca_education_correction_missing_reason, "unsupported");
});

test("Rey and QOLIE partial-scoring policies survive the contract", () => {
  const session = { collection_version: 2, rey_copy: { scores: { 1: 0 } }, qolie31: { responses: { 1: 0 } } };
  const row = appendExportContract({ ...getReyExportFields(session.rey_copy), ...getQolie31ExportFields(session.qolie31) }, session);
  assert.equal(row.rey_copy_element_1, 0);
  assert.equal(row.rey_copy_element_1_missing_reason, "");
  assert.equal(row.rey_copy_total_missing_reason, "unknown");
  assert.equal(row.qolie31_overall_quality_of_life, 0);
  assert.equal(row.qolie31_overall, null);
  assert.equal(row.qolie31_overall_missing_reason, "unknown");
});

test("nonfinite numbers cannot masquerade as results", () => {
  const row = appendExportContract({ tmt_a_s: NaN, tmt_b_s: Infinity }, {});
  assert.equal(row.tmt_a_s, null);
  assert.equal(row.tmt_b_s, null);
  assert.equal(row.tmt_a_s_missing_reason, "error");
});

test("invalid QOLIE inputs flag only affected missing results", () => {
  const session = { qolie31: { responses: { 1: 999 } } };
  const row = appendExportContract(getQolie31ExportFields(session.qolie31), session);
  assert.equal(row.qolie31_item_1_score_missing_reason, "error");
  assert.equal(row.qolie31_overall_quality_of_life_missing_reason, "error");
  assert.equal(row.qolie31_overall_missing_reason, "error");
  assert.equal(row.qolie31_item_2_score_missing_reason, "unknown");
  assert.equal(row.qolie31_item_1_raw, 999); // Retained with validation diagnostics for audit.
});

test("CERAD recognition is recomputed from all expected response keys", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ word: `word${i}`, isOrig: i < 10 }));
  const responses = Object.fromEntries(items.map(({ word }) => [word, "ja"]));
  const row = normalizeAssessmentResults({}, { cerad_wl: { recog: { responses } } }, { ceradRecognitionItems: items });
  assert.equal(row.cerad_wl_recog_correct_yes, 10);
  assert.equal(row.cerad_wl_recog_correct_no, 0);
  responses.word19 = null; responses.foreign = "ja";
  assert.equal(normalizeAssessmentResults({}, { cerad_wl: { recog: { responses } } }, { ceradRecognitionItems: items }).cerad_wl_recog_correct_yes, null);
});

test("early recall navigation cannot complete untouched DCS trials", () => {
  const row = normalizeAssessmentResults({}, { dcsr: { step: "rekog", dg: 1, counts: [{ richtig: 3 }] } });
  assert.equal(row.dcsr_dg1_hits, 3);
  assert.equal(row.dcsr_sum_dg1_5, null);
});

test("uppercase CERAD and Epi abort limits are not observations", () => {
  const session = { cerad_tmt_aborted: { A: { part: "A" } }, epi_aborted: { zahlen_buchstaben: { limit_ms: 300000 } } };
  const row = normalizeAssessmentResults({ cerad_tmt_a_s: 180, epi_zahlen_buchstaben_s: 300 }, session);
  assert.equal(row.cerad_tmt_a_s, null);
  assert.equal(row.epi_zahlen_buchstaben_s, null);
});
