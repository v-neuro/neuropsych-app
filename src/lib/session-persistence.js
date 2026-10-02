// Keep the immediate recovery backup, but reuse it for debounced/lifecycle saves.
const STATE_KEYS = ["screen", "globalTimers", "activePipeline", "pipelineInterruption", "sessionData", "sessionUUID"];

export function createSessionPersistence({ writeBackup, writeSession, onError, now = Date.now }) {
  let previousState;
  let snapshot;
  let backedUp;
  let requested;
  let pending = Promise.resolve();

  const backup = (state) => {
    if (!previousState || STATE_KEYS.some((key) => previousState[key] !== state[key])) {
      previousState = state;
      snapshot = { ...state, lastUpdated: now() };
    }
    if (backedUp !== snapshot) {
      try {
        writeBackup(snapshot);
        backedUp = snapshot;
      } catch (error) {
        onError?.(error); // A later flush retries; still attempt the independent IDB save.
      }
    }
    return snapshot;
  };

  const flush = (state) => {
    const next = backup(state);
    if (requested === next) return pending;
    requested = next;
    // Serialize writes so an older, slower write cannot overwrite a newer one.
    pending = pending.then(() => writeSession(next.sessionUUID, next)).catch((error) => {
      if (requested === next) requested = undefined;
      onError?.(error);
    });
    return pending;
  };

  return { backup, flush };
}
