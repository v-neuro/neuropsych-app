// QOLIE-31 Scoring Manual, Version 1.0 (RAND, 1993), Tables 2 and 4.
// Canonical IDs refer to individual manual items, NOT German question blocks.
export const QOLIE31_SCORING_VERSION = "QOLIE31_v1.0_DE_MAPI1997";
export const QOLIE31_OVERALL_POLICY = "all_seven_subscales_required_no_reweighting";

const rules = {};
const addRules = (ids, responseScores) => ids.forEach((id) => {
  rules[id] = Object.freeze({ id, responseScores: Object.freeze(responseScores) });
});
addRules([1], Object.fromEntries(Array.from({ length: 11 }, (_, raw) => [raw, raw * 10])));
addRules([2, 5, 6, 9], { 1: 100, 2: 80, 3: 60, 4: 40, 5: 20, 6: 0 });
addRules([3, 4, 7, 8, 10, 11, 12, 13, 16, 17, 18], { 1: 0, 2: 20, 3: 40, 4: 60, 5: 80, 6: 100 });
addRules([14, 25, 26, 27, 28, 29, 30], { 1: 100, 2: 75, 3: 50, 4: 25, 5: 0 });
addRules([15, 21, 23, 24], { 1: 0, 2: 33.3, 3: 66.7, 4: 100 });
addRules([19, 20], { 1: 0, 2: 25, 3: 50, 4: 75, 5: 100 });
addRules([22], { 1: 0, 2: 50, 3: 100 });
rules[31] = Object.freeze({ id: 31, healthRating: true, min: 0, max: 100 });
export const QOLIE31_ITEM_RULES = Object.freeze(rules);

export const QOLIE31_SUBSCALES = Object.freeze([
  { key: "seizure_worry", label: "Sorgen wegen Anfällen", items: [11, 21, 22, 23, 25], weight: 0.08 },
  { key: "overall_quality_of_life", label: "Allgemeine Lebensqualität", items: [1, 14], weight: 0.14 },
  { key: "emotional_well_being", label: "Emotionales Wohlbefinden", items: [3, 4, 5, 7, 9], weight: 0.15 },
  { key: "energy_fatigue", label: "Energie/Müdigkeit", items: [2, 6, 8, 10], weight: 0.12 },
  { key: "cognitive_functioning", label: "Kognitive Funktionen", items: [12, 15, 16, 17, 18, 26], weight: 0.27 },
  { key: "medication_effects", label: "Auswirkungen der Medikamente", items: [24, 29, 30], weight: 0.03 },
  { key: "social_functioning", label: "Soziale Funktionen", items: [13, 19, 20, 27, 28], weight: 0.21 },
].map((scale) => Object.freeze({ ...scale, items: Object.freeze(scale.items) })));

export function transformQolie31Item(id, raw) {
  const rule = QOLIE31_ITEM_RULES[id];
  if (!rule) throw new RangeError(`Unbekanntes QOLIE-31-Item: ${id}.`);
  if (raw === null || raw === undefined) return null;
  const valid = typeof raw === "number" && Number.isFinite(raw) && (rule.healthRating
    ? raw >= rule.min && raw <= rule.max
    : Number.isInteger(raw) && Object.hasOwn(rule.responseScores, raw));
  if (!valid) {
    const domain = rule.healthRating ? "eine Zahl von 0 bis 100" : `einen der Antwortcodes ${Object.keys(rule.responseScores).join(", ")}`;
    throw new RangeError(`Item ${id}: Bitte ${domain} angeben.`);
  }
  // The thermometer is retained separately, not a transformed scoring item.
  return rule.healthRating ? raw : rule.responseScores[raw];
}

export function calculateQolie31(responses = {}) {
  const errors = {};
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
    errors.responses = "QOLIE-31-Antworten müssen nach kanonischer Itemnummer gespeichert sein.";
    responses = {};
  }
  for (const id of Object.keys(responses)) {
    if (!Object.hasOwn(QOLIE31_ITEM_RULES, id)) errors[id] = `Unbekanntes QOLIE-31-Item: ${id}.`;
  }
  const items = Object.fromEntries(Object.values(QOLIE31_ITEM_RULES).map(({ id }) => {
    const raw = responses[id] ?? null;
    try {
      const value = transformQolie31Item(id, raw);
      return [id, { raw, score: id === 31 ? null : value, answered: value !== null }];
    } catch (error) {
      errors[id] = error.message;
      return [id, { raw, score: null, answered: false }];
    }
  }));
  const subscales = Object.fromEntries(QOLIE31_SUBSCALES.map((scale) => {
    const available = scale.items.map((id) => items[id].score).filter((value) => value !== null);
    const invalid = scale.items.some((id) => errors[id]);
    const score = available.length && !invalid ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
    return [scale.key, { score, answeredCount: available.length, itemCount: scale.items.length, complete: available.length === scale.items.length && !invalid }];
  }));
  const scoredAnsweredCount = Object.entries(items).filter(([id, item]) => Number(id) <= 30 && item.answered).length;
  // Application policy: an entirely unavailable scale prevents the overall score.
  // Do not redistribute weights. No intermediate or export rounding.
  const overall = QOLIE31_SUBSCALES.every(({ key }) => subscales[key].score !== null) && !Object.keys(errors).some((key) => key !== "31")
    ? QOLIE31_SUBSCALES.reduce((sum, { key, weight }) => sum + subscales[key].score * weight, 0)
    : null;
  const healthAnswered = items[31].answered;
  return {
    items, subscales, overall, scoredAnsweredCount, scoredComplete: scoredAnsweredCount === 30,
    health: healthAnswered ? items[31].raw : null, healthAnswered,
    complete: scoredAnsweredCount === 30 && healthAnswered && Object.keys(errors).length === 0,
    errors,
  };
}

export function getQolie31Assessment(data = {}) {
  const result = calculateQolie31(data.responses);
  if (data.scoring_version && data.scoring_version !== QOLIE31_SCORING_VERSION) {
    result.errors.scoring_version = `Unbekannte QOLIE-31-Scoringversion: ${data.scoring_version}. Ergebnisse nicht verfügbar.`;
    result.overall = null;
    result.complete = false;
    result.scoredComplete = false;
    Object.values(result.subscales).forEach((scale) => { scale.score = null; scale.complete = false; });
  }
  return result;
}

export function getQolie31ExportFields(data = {}, aborted) {
  const result = getQolie31Assessment(data);
  const hasData = Object.values(result.items).some(({ raw }) => raw !== null) || !!data.notes || !!aborted || !!data.scoring_version;
  const fields = {
    qolie31_entry_mode: hasData ? "items" : "",
    qolie31_scoring_version: hasData ? data.scoring_version || QOLIE31_SCORING_VERSION : "",
    qolie31_overall_policy: QOLIE31_OVERALL_POLICY,
  };
  Object.entries(result.items).forEach(([id, item]) => {
    fields[`qolie31_item_${id}_raw`] = item.raw;
    if (id !== "31") fields[`qolie31_item_${id}_score`] = result.errors.scoring_version ? null : item.score;
  });
  QOLIE31_SUBSCALES.forEach(({ key }) => {
    const scale = result.subscales[key];
    fields[`qolie31_${key}`] = scale.score;
    fields[`qolie31_${key}_answered_count`] = hasData ? scale.answeredCount : null;
    fields[`qolie31_${key}_complete`] = hasData ? Number(scale.complete) : null;
  });
  return {
    ...fields,
    qolie31_overall: result.overall,
    qolie31_scored_answered_count: hasData ? result.scoredAnsweredCount : null,
    qolie31_scored_completed: hasData ? Number(result.scoredComplete) : null,
    qolie31_overall_partial: result.overall === null ? null : Number(!result.scoredComplete),
    qolie31_general_health: result.health,
    qolie31_health_answered: hasData ? Number(result.healthAnswered) : null,
    qolie31_completed: hasData ? Number(result.complete && !aborted) : null,
    qolie31_validation_errors: Object.keys(result.errors).length ? JSON.stringify(result.errors) : "",
    qolie31_notes: data.notes || "",
    qolie31_aborted: aborted ? 1 : 0,
    qolie31_abort_reason: aborted?.reason || "",
    qolie31_abort_note: aborted?.note || "",
  };
}
