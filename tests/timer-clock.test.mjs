import assert from "node:assert/strict";
import test from "node:test";
import { readStopwatch, remainingUntil } from "../src/lib/timer-clock.js";

test("countdown uses its deadline, irrespective of missing or infrequent callbacks", () => {
  const started = 1_000_000;
  const deadline = started + 60_000;
  for (const elapsed of [0, 1, 100, 7500, 30000, 59999, 60000, 120000, 86400000]) {
    assert.equal(remainingUntil(deadline, started + elapsed), Math.max(0, 60000 - elapsed));
  }
});

test("pause/resume excludes the paused interval while preserving remaining time", () => {
  const remaining = remainingUntil(60000, 7500);
  const resumedAt = 100000;
  assert.equal(remainingUntil(resumedAt + remaining, resumedAt + 2500), 50000);
});

test("stopwatch samples actual elapsed time, not callback counts", () => {
  for (const elapsed of [0, 50, 3253, 10000, 86400000]) {
    assert.deepEqual(readStopwatch(1000, 1000 + elapsed), { elapsedMs: elapsed, limitReached: false });
  }
  assert.deepEqual(readStopwatch(1000, 999), { elapsedMs: 0, limitReached: false });
});

test("resuming a stopped stopwatch retains previously accumulated elapsed time", () => {
  const alreadyElapsed = 4500;
  const resumedAt = 25000;
  assert.deepEqual(readStopwatch(resumedAt - alreadyElapsed, 30000), { elapsedMs: 9500, limitReached: false });
});

test("time limits apply at the exact boundary and clamp any late sample", () => {
  for (const limit of [180000, 300000]) {
    assert.deepEqual(readStopwatch(1000, 1000 + limit - 1, limit), { elapsedMs: limit - 1, limitReached: false });
    assert.deepEqual(readStopwatch(1000, 1000 + limit, limit), { elapsedMs: limit, limitReached: true });
    assert.deepEqual(readStopwatch(1000, 1000 + limit + 10000, limit), { elapsedMs: limit, limitReached: true });
  }
});

test("fractional millisecond precision is retained; absent/invalid limits do not abort", () => {
  for (const limit of [undefined, null, 0, -1, NaN, Infinity]) {
    assert.deepEqual(readStopwatch(1000, 1001.25, limit), { elapsedMs: 1.25, limitReached: false });
  }
});
