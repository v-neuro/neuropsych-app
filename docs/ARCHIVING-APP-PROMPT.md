Copy the following prompt into the coding LLM for the archiving application:

---

Update this archiving application to support the digitale-npt examination export schema v2. Implement and test the changes in this repository. Inspect its existing importer, database, migrations, reports, and statistical queries first. Preserve existing archives and support both legacy and v2 imports. Do not ask examiners to supply reasons for unused tests.

## Source format and version detection

The source app exports UTF-8 CSV with a semicolon (`;`) delimiter, one header row, and one examination per data row. Use a proper CSV parser that handles quoted fields, escaped quotes, embedded semicolons/newlines, CRLF/LF, and an optional UTF-8 BOM. Numeric values may be quoted; decimals use a dot. Do not split lines or fields manually.

All original columns retain their names and positions. New metadata is appended. Map by header name, never by column position or filename. `session_uuid` identifies the source examination; preserve existing deduplication/update rules.

- `export_schema_version`: string `2` identifies the new contract. An absent version identifies a legacy export. Reject or quarantine unsupported explicit versions with a useful error; do not silently treat them as legacy.
- `export_missing_reason_system`: `http://terminology.hl7.org/CodeSystem/data-absent-reason`.
- Every original field `X` has a companion column `X_missing_reason`, including scores, raw responses, counts, notes, demographics, and legacy abort flags. These companions are appended, rather than interleaved with existing columns. New version/system metadata and assessment-status columns do not themselves have companions.
- Every test group has a `GROUP_assessment_status` column.

The source borrows HL7 DataAbsentReason terminology; the CSV is not a FHIR resource.

## Values and missing reasons

Keep a typed nullable result and a separate nullable missing reason. Never put a missing-reason code into a numeric score column. Do not substitute zero, an empty string, `NaN`, a magic number such as -999, or the literal string `"NULL"` for database NULL.

| Source value | Companion reason | Import behavior |
| --- | --- | --- |
| `12` | empty | Store the numeric value 12; missing reason NULL |
| `0` | empty | Store numeric zero; missing reason NULL |
| `0.5` | empty | Preserve the fraction and source precision |
| empty | `not-performed` | Store result NULL; reason `not-performed` |
| empty | `unknown` | Store result NULL; reason `unknown` |
| empty | `not-applicable` | Store result NULL; reason `not-applicable` |
| empty | `unsupported` | Store result NULL; reason `unsupported` |
| empty | `error` | Store result NULL; reason `error` |

Definitions:

- `not-performed`: no data for this test were recorded during an examination created with collection tracking v2. This is assigned automatically; there is no examiner reason-entry step.
- `unknown`: the value is unavailable, but the source cannot establish a more specific reason. This includes ambiguous historical data, incomplete calculations, and missing parts of a started test. Do not relabel this as `not-performed`.
- `not-applicable`: the field is unused in the selected entry mode, for example PHQ-9 item fields when only a manual total was entered.
- `unsupported`: the source does not provide this field. In particular, `moca_education_years` and `moca_education_correction` remain empty and carry `unsupported` because this app does not calculate a MoCA education correction.
- `error`: an unavailable result associated with a detected processing/validation problem. Retain source diagnostics such as `qolie31_validation_errors`.

An empty reason beside a nonempty value means “a value was exported”; it is not a blanket claim that the entire test is complete or that externally supplied raw data passed every clinical validation. Preserve validation diagnostics, entry mode, scoring version, and completion flags. Validate each typed numeric field explicitly. Never use truthiness to detect a result: zero and false are present values. Inspect emptiness before numeric conversion (`Number("")` must never create a zero).

For a v2 nonempty value with a nonempty missing reason, flag a contradictory record rather than discarding either part silently. For a v2 empty value with a missing/empty companion, import conservatively as NULL/`unknown` and report a schema warning. Preserve unrecognized reason codes as metadata with a warning so future codes are not lost. Preserve the original source file or payload for audit, using the app's existing security and retention rules.

## Test status is separate from result missingness

Supported values are:

- `not-performed`: untouched test in a newly tracked examination.
- `unknown`: no reliable result or performance evidence is available.
- `recorded`: some results/data exist; completion is not established.
- `completed`: the source has sufficient completion evidence for this test.
- `aborted`: an abortion was recorded. Individual available results are still retained.

Groups are `vlmt`, `dcsr`, `epi`, `tmt`, `stroop`, `gp`, `cerad_mmst`, `cerad_wl`, `cerad_bnt`, `cerad_wf`, `cerad_tmt`, `cerad_fig`, `uhr`, `rwt`, `zahl_fwd`, `zahl_rev`, `block_fwd`, `block_rev`, `ace`, `moca`, `phq9`, `gad7`, `gds`, `rey_copy`, and `qolie31`.

Note that the naming-test status group is `cerad_bnt`, while its existing abort field is `cerad_benennen_aborted`. Original `*_aborted` fields still use 0/1: zero means no abortion is recorded; it does not prove the test was administered. A version selection or note alone also does not prove a score or completed test. Do not infer completion just because a numeric field is present.

## Scoring changes the importer must respect

The source now suppresses several previously fabricated or premature totals. Do not recreate missing results from zeros or assume that old numeric exports were collected with the stricter v2 rules.

- VLMT: missing trials no longer become zero scores. The DG1–5 sum and DG5-to-DG7 loss require their input values. Recognition remains unavailable without response/confirmation evidence.
- DCS-R: a performed zero-point DG1 remains zero; an unfinished DG1–5 series has no five-trial total. Recognition zeros are retained when confirmed, rather than being confused with unused default counters. Values filled by the existing ceiling rule are retained.
- Stroop: other timed parts do not establish zero interference errors/corrections.
- CERAD word list: each recall trial has separate evidence; absent trials remain missing. Recognition counts require all 20 explicit yes/no answers and are recalculated from those answers.
- CERAD Boston Naming Test: the final count requires all 15 explicit correct/incorrect responses; a partially answered form has no final total.
- MMST: the total requires either all explicit responses or the existing Finish action confirming the checkbox assessment (including zero-point items). Earlier drafts have no final total.
- ACE-III and MoCA: unentered items remain missing. Section and final totals require all contributing items. The source offers an explicit “0 Punkte erfassen” action for zero-point items, rather than assuming its initial display defaults were assessments. ACE recognition retains its existing automatic-credit rule for full delayed recall. MoCA learning runs are kept separate.
- Empty span defaults do not establish a zero span score.
- Timed TMT/CERAD TMT and automatically aborted timed Epi-Track parts: stored cutoff limits are not exported as measured completion times. Keep abortion status; do not reconstruct an actual time from the cutoff.
- Existing Rey and QOLIE-31 scoring policies remain intact. A documented subtotal or a permitted partial QOLIE score can be meaningful while the test is incomplete. Preserve completion/partial flags and answered counts instead of forcing every incomplete test's existing result to NULL.

## Legacy imports and backups

Continue accepting legacy CSVs that have neither version nor companion columns. Nonempty values remain the exported historical values; empty values become NULL with reason `unknown`. Do not automatically rewrite historical zero scores, infer `not-performed`, or claim that v2 corrected old imported scores. Preserve provenance/version so users can distinguish historical exports from v2 exports. Migrate existing database records conservatively: backfill unknown missingness, rather than guessed clinical reasons.

The source's `.npt-backup.json` (and `.npt-backup.txt`) is still a full raw assessment backup, with its existing envelope/checksum. It is not the flat CSV schema. It now may contain `snapshot.sessionData.collection_version = 2` and per-trial `assessed` flags / `cerad_mmst.assessment_complete`. Preserve these fields when handling backups. Do not strip them, change the backup envelope version, or interpret their absence as evidence of nonperformance. Continue validating the backup format/checksum. If this app derives results from backups, audit that derivation against the v2 scoring changes above; preferably share/port the source rules. Do not apply generic zero defaults to raw backups.

The printable PDF uses the same corrected results and shows German missingness labels in result cells. Prefer CSV or a supported structured-backup importer for data ingestion; do not infer numeric results from PDF labels or drawings.

## Archive UI, analysis, and validation

Display missing results with readable labels (“Not performed”, “Unknown/not documented”, “Not applicable”, “Unsupported”, “Result unavailable”). Show genuine zero as `0`. Retain available values from interrupted tests, accompanied by their status. Allow filtering by test status and missing reason. Make cohort calculations, averages, ranges, charts, and denominators exclude NULL results while including real zeros. Do not hide whole examinations merely because most tests were not used.

Add migration/import/query tests for:

1. Zero versus missing versus false; fractions and unrounded precision.
2. Untouched v2 tests (`not-performed`) versus legacy blanks (`unknown`).
3. Partial and aborted tests that retain valid individual results but have missing totals.
4. Missing/contradictory reason pairs, unrecognized codes, malformed numbers, and unsupported schema versions.
5. Manual questionnaire totals with unused item fields, and unsupported MoCA correction fields.
6. CSV quoting, embedded delimiters/newlines, reordered columns, optional BOM, and extra future columns.
7. Existing deduplication/update behavior, with missingness changes handled consistently and no cross-examination mixing.
8. Existing archives remain readable; no historical values or reasons are guessed or silently overwritten.

Implement the appropriate migration and importer changes, run the relevant checks, then report the changed behavior, validation results, and any remaining incompatibilities. Provide a concrete implementation rather than only a plan.
