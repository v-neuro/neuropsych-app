import test from "node:test";
import assert from "node:assert/strict";
import { calculatePatientAge } from "../src/lib/patient-age.js";

test("age counts completed years on the examination date", () => {
  assert.equal(calculatePatientAge("1954-06-15", "2026-06-14"), 71);
  assert.equal(calculatePatientAge("1954-06-15", "2026-06-15"), 72);
  assert.equal(calculatePatientAge("1954-06-15", "2026-06-16"), 72);
  assert.equal(calculatePatientAge("1954-12-31", "2026-01-01"), 71);
  assert.equal(calculatePatientAge("2026-06-15", "2026-06-15"), 0);
});

test("leap-day birthdays count from March 1 in non-leap years", () => {
  assert.equal(calculatePatientAge("2000-02-29", "2025-02-28"), 24);
  assert.equal(calculatePatientAge("2000-02-29", "2025-03-01"), 25);
  assert.equal(calculatePatientAge("2000-02-29", "2024-02-28"), 23);
  assert.equal(calculatePatientAge("2000-02-29", "2024-02-29"), 24);
});

test("missing, invalid and future birth dates cannot produce an age", () => {
  for (const date of [undefined, null, "", "1954-06", "15.06.1954", "0000-01-01", "1900-02-29", "2000-02-30", "1954-04-31", "1954-13-01", "1954-01-00", "2026-06-16"]) {
    assert.equal(calculatePatientAge(date, "2026-06-15"), null, String(date));
  }
  assert.equal(calculatePatientAge("1954-06-15", "2026-02-30"), null);
  assert.equal(calculatePatientAge("1954-06-15", ""), null);
  assert.equal(calculatePatientAge("0099-01-01", "0100-01-01"), 1);
});
