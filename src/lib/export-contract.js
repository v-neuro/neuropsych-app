// CSV v2 keeps numeric results nullable and carries missingness separately.
// These reason codes use HL7 DataAbsentReason; this is not a FHIR resource.
import { getQolie31Assessment, QOLIE31_SUBSCALES } from "./qolie31-scoring.js";

export const EXPORT_SCHEMA_VERSION = "2";
export const COLLECTION_VERSION = 2;
export const TEST_SOURCES = {
  vlmt: ["vlmt"], dcsr: ["dcsr"], epi: ["epi"],
  tmt: ["tmt_a", "tmt_b", "tmt_a_note", "tmt_b_note"],
  stroop: ["stroop", "stroop_notes"], gp: ["gp"],
  cerad_mmst: ["cerad_mmst"], cerad_wl: ["cerad_wl"],
  cerad_bnt: ["cerad_benennen"], cerad_wf: ["cerad_wf"],
  cerad_tmt: ["cerad_tmt", "cerad_tmt_a", "cerad_tmt_b"], cerad_fig: ["cerad_fig"],
  uhr: ["uhr"], rwt: ["rwt"], zahl_fwd: ["zahl_fwd"], zahl_rev: ["zahl_rev"],
  block_fwd: ["block_fwd"], block_rev: ["block_rev"], ace: ["ace"], moca: ["moca"],
  phq9: ["phq9"], gad7: ["gad7"], gds: ["gds"], rey_copy: ["rey_copy"], qolie31: ["qolie31"],
};

export const isRecorded = (value) => value !== null && value !== undefined && value !== "";
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const hasEntries = (value) => value && Object.keys(value).length > 0;
const sumComplete = (values) => values.every(finite) ? values.reduce((a, b) => a + b, 0) : null;

function fieldTest(key) {
  if (key === "notes_mmst") return "cerad_mmst";
  if (key === "notes_benennen" || key.startsWith("cerad_benennen_")) return "cerad_bnt";
  if (key.startsWith("notes_")) key = key.slice(6);
  return Object.keys(TEST_SOURCES).find((test) => key.startsWith(`${test}_`));
}

function aborted(session, test) {
  const keys = TEST_SOURCES[test];
  return keys.some((key) => {
    const flag = session[`${key}_aborted`];
    return flag && (typeof flag !== "object" || Object.values(flag).some(Boolean));
  }) || (test === "tmt" && !!session.tmt_aborted);
}

// Repair calculations that used to substitute zero for untouched parts.
export function normalizeAssessmentResults(row, s, { aceSections = [], mocaSections = [], aceItemScore, aceRecognitionComplete, mmstTotal, mmstComplete, ceradRecognitionItems = [] } = {}) {
  const vlmt = s.vlmt || {};
  const trials = Array.from({ length: 7 }, (_, i) => {
    const trial = vlmt.results?.[i];
    // Empty arrays/objects are created when merely opening the screen.
    const advanced = i < 5 && ((vlmt.step === "score" && Number(vlmt.dg) > i + 1)
      || ["interf", "dg6", "waiting", "dg7", "rekog"].includes(vlmt.step));
    const completed = trial?.assessed === true || advanced
      || (i === 5 && ["waiting", "dg7", "rekog"].includes(vlmt.step))
      || (i === 6 && vlmt.step === "rekog");
    return completed || hasEntries(trial?.sel)
      ? Object.values(trial?.sel || {}).filter(Boolean).length : null;
  });
  row.vlmt_sum_dg1_5 = sumComplete(trials.slice(0, 5));
  row.vlmt_dg5_hits = trials[4]; row.vlmt_dg6_hits = trials[5]; row.vlmt_dg7_hits = trials[6];
  row.vlmt_loss_dg5_to_dg7 = finite(trials[4]) && finite(trials[6]) ? trials[4] - trials[6] : null;
  if (!(vlmt.rekog?.assessed || hasEntries(vlmt.rekog?.sel))) row.vlmt_rekog_correct_minus_fp = null;

  const dcsr = s.dcsr || {};
  const dcsrTrials = Array.from({ length: 5 }, (_, i) => {
    const trial = dcsr.counts?.[i];
    const assessed = trial?.assessed || Number(dcsr.dg) > i + 1
      || (["waiting", "rekog"].includes(dcsr.step) && Number(dcsr.dg) >= i + 1)
      || ["richtig", "falsch", "gedreht", "perseveration"].some((key) => trial?.[key] > 0);
    return assessed ? (trial?.richtig ?? 0) : null;
  });
  row.dcsr_dg1_hits = dcsrTrials[0];
  row.dcsr_sum_dg1_5 = sumComplete(dcsrTrials);
  const recog = dcsr.rekog?.responses || {};
  const hasRecog = dcsr.rekog?.assessed || (Array.isArray(recog)
    ? recog.some((v) => ["korrekt", "falsch", "gedreht"].includes(v))
    : Object.values(recog).some((v) => v > 0));
  row.dcsr_rekog_correct = hasRecog ? (Array.isArray(recog) ? recog.filter((v) => v === "korrekt").length : Number(recog.korrekt || 0)) : null;
  row.dcsr_rekog_wrong = hasRecog ? (Array.isArray(recog) ? recog.filter((v) => ["falsch", "gedreht"].includes(v)).length : Number(recog.falsch || 0) + Number(recog.gedreht || 0)) : null;

  if (!finite(s.stroop?.interferenz) && !hasEntries(s.stroop_notes?.interferenz_fails)) {
    row.stroop_interferenz_errors = null; row.stroop_interferenz_corrected = null;
  }
  for (const key of ["dg1", "dg2", "dg3", "dg4"]) {
    const trial = s.cerad_wl?.[key];
    if (!(trial?.assessed || hasEntries(trial?.marks) || trial?.intrusions > 0)) {
      row[`cerad_wl_${key}_hits`] = null; row[`cerad_wl_${key}_intrusions`] = null;
    } else {
      row[`cerad_wl_${key}_hits`] = Object.values(trial.marks || {}).filter(Boolean).length;
      row[`cerad_wl_${key}_intrusions`] = trial.intrusions ?? 0;
    }
  }
  const ceradRecog = s.cerad_wl?.recog;
  // Recognition requires all 20 explicit yes/no responses, not just the first answer.
  if (ceradRecognitionItems.length !== 20 || !ceradRecognitionItems.every(({ word }) => ["ja", "nein"].includes(ceradRecog?.responses?.[word]))) {
    row.cerad_wl_recog_correct_yes = null; row.cerad_wl_recog_correct_no = null;
  } else {
    row.cerad_wl_recog_correct_yes = ceradRecognitionItems.filter(({ word, isOrig }) => isOrig && ceradRecog.responses[word] === "ja").length;
    row.cerad_wl_recog_correct_no = ceradRecognitionItems.filter(({ word, isOrig }) => !isOrig && ceradRecog.responses[word] === "nein").length;
  }
  const naming = s.cerad_benennen?.items;
  if (!Array.isArray(naming) || naming.length !== 15 || !naming.every((item) => typeof item?.correct === "boolean")) row.cerad_bnt_correct = null;
  row.cerad_mmst_total = (s.cerad_mmst?.assessment_complete || mmstComplete?.(s.cerad_mmst?.items || {})) && mmstTotal
    ? mmstTotal(s.cerad_mmst?.items || {}) : null;

  for (const [test, sections] of [["ace", aceSections], ["moca", mocaSections]]) {
    if (!sections.length) continue;
    const data = s[test] || {};
    for (const section of sections) {
      for (const item of section.items) {
        const explicit = data.scores?.[item.key];
        let value = finite(explicit) ? Math.max(0, Math.min(item.max, explicit)) : null;
        if (test === "ace" && item.key === "recognition" && aceItemScore) {
          // Full delayed recall awards recognition points under the existing scoring rule.
          const automatic = data.scores?.recall_name_address >= 7;
          if (automatic || aceRecognitionComplete?.(data)) value = aceItemScore(data, item);
          else value = null;
        }
        row[`${test}_${section.key}_${item.key}`] = value;
      }
      row[`${test}_${section.key}_score`] = sumComplete(section.items.map((item) => row[`${test}_${section.key}_${item.key}`]));
    }
    row[`${test}_total`] = sumComplete(sections.map((section) => row[`${test}_${section.key}_score`]));
    if (test === "moca") row.moca_raw_total = row.moca_total;
  }
  for (let i = 0; i < 2; i++) {
    const run = s.moca?.raw?.learning?.runs?.[i];
    row[`moca_learning_trial_${i + 1}`] = run?.assessed || hasEntries(run?.marks) ? Object.values(run.marks || {}).filter(Boolean).length : null;
  }
  for (const test of ["zahl_fwd", "zahl_rev", "block_fwd", "block_rev"]) {
    if (!s[test]?.vals?.some((v) => [0, 1].includes(v?.v1) || [0, 1].includes(v?.v2))) {
      row[`${test}_longest`] = null; row[`${test}_correct_sum`] = null;
    }
  }
  // Abort handlers store time limits for display. These are not measured times.
  for (const part of ["a", "b"]) {
    if (s[`tmt_${part}_aborted`] || s.tmt_aborted?.part?.toLowerCase() === part) row[`tmt_${part}_s`] = null;
    if (s[`cerad_tmt_${part}_aborted`] || s.cerad_tmt_aborted?.[part] || s.cerad_tmt_aborted?.[part.toUpperCase()] || s.cerad_tmt_aborted?.part?.toLowerCase() === part) row[`cerad_tmt_${part}_s`] = null;
  }
  for (const part of ["zahlen_verbinden", "zahlen_buchstaben"]) {
    if (s.epi_aborted?.[part] || s.epi_aborted?.subtest === part) row[`epi_${part}_s`] = null;
  }
  return row;
}

export function appendExportContract(row, session = {}) {
  const keys = Object.keys(row); // Preserve all original column positions.
  const invalidNumbers = new Set(keys.filter((key) => typeof row[key] === "number" && !Number.isFinite(row[key])));
  for (const key of invalidNumbers) row[key] = null;
  const qolieErrors = getQolie31Assessment(session.qolie31 || {}).errors;
  const qolieErrorFields = new Set();
  for (let id = 1; id <= 30; id++) {
    if (qolieErrors[id] || qolieErrors.scoring_version) qolieErrorFields.add(`qolie31_item_${id}_score`);
  }
  for (const scale of QOLIE31_SUBSCALES) {
    if (qolieErrors.scoring_version || scale.items.some((id) => qolieErrors[id])) qolieErrorFields.add(`qolie31_${scale.key}`);
  }
  if (qolieErrorFields.size || qolieErrors.responses) qolieErrorFields.add("qolie31_overall");
  if (qolieErrors[31]) qolieErrorFields.add("qolie31_general_health");
  const statuses = {};
  for (const [test, sources] of Object.entries(TEST_SOURCES)) {
    const touched = sources.some((key) => isRecorded(session[key]));
    const values = keys.filter((key) => fieldTest(key) === test && !/(?:_aborted|_notes?|_version|_scoring|_policy|_entry_mode|_abort_reason|_abort_note|_validation_errors)$/.test(key));
    const recorded = values.some((key) => isRecorded(row[key]));
    const complete = row[`${test}_completed`] === 1
      || (["ace", "moca", "cerad_mmst"].includes(test) && finite(row[`${test}_total`]))
      || (test === "cerad_bnt" && finite(row.cerad_bnt_correct));
    statuses[test] = aborted(session, test) ? "aborted" : complete ? "completed" : recorded ? "recorded"
      : !touched && session.collection_version === COLLECTION_VERSION ? "not-performed" : "unknown";
  }
  row.export_schema_version = EXPORT_SCHEMA_VERSION;
  row.export_missing_reason_system = "http://terminology.hl7.org/CodeSystem/data-absent-reason";
  for (const key of keys) {
    const test = fieldTest(key);
    let reason = isRecorded(row[key]) ? "" : test && statuses[test] === "not-performed" ? "not-performed" : "unknown";
    if (invalidNumbers.has(key)) reason = "error";
    if (!isRecorded(row[key]) && ["moca_education_years", "moca_education_correction"].includes(key)) reason = "unsupported";
    for (const questionnaire of ["phq9", "gad7", "gds"]) {
      if (!isRecorded(row[key]) && key.startsWith(`${questionnaire}_`) && statuses[questionnaire] !== "not-performed") {
        const manual = row[`${questionnaire}_entry_mode`] === "manual";
        if ((manual && (key.includes("_item_") || key.endsWith("_answered_count"))) || (!manual && key.endsWith("_manual_total"))) reason = "not-applicable";
      }
    }
    if (!isRecorded(row[key]) && qolieErrorFields.has(key)) reason = "error";
    row[`${key}_missing_reason`] = reason;
  }
  for (const [test, status] of Object.entries(statuses)) row[`${test}_assessment_status`] = status;
  return row;
}
