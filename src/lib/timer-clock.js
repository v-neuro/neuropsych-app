// Sampling frequency only affects the display, never the amount of measured time.
// Epoch timestamps continue to account for time while a browser/device is asleep.
export function remainingUntil(deadlineMs, nowMs) {
  return Math.max(0, deadlineMs - nowMs);
}

export function readStopwatch(startMs, nowMs, timeLimitMs) {
  const measuredMs = Math.max(0, nowMs - startMs);
  const hasLimit = Number.isFinite(timeLimitMs) && timeLimitMs > 0;
  const limitReached = hasLimit && measuredMs >= timeLimitMs;
  return { elapsedMs: limitReached ? timeLimitMs : measuredMs, limitReached };
}
