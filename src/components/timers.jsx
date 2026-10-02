import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { useClockRefresh } from "../lib/utils";
import { readStopwatch, remainingUntil } from "../lib/timer-clock";
import { Button } from "./ui";

function fmtMs(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function ResetTimerConfirm({ open, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="w-[420px] max-w-[95vw] rounded-2xl border bg-white p-4 shadow-lg">
        <div className="text-lg font-medium">Timer wirklich zurücksetzen?</div>
        <p className="mt-2 text-sm text-zinc-600">
          Der aktuell gespeicherte Zeitwert wird auf 0 gesetzt.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Zurücksetzen
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Stopwatch = forwardRef(function Stopwatch({ persisted, ...props }, ref) {
  const persistedKey = typeof persisted === "number" && persisted >= 0 ? persisted : "empty";
  return <StopwatchState key={persistedKey} ref={ref} persisted={persisted} {...props} />;
});

const StopwatchState = forwardRef(function StopwatchState({ persisted, onPersist, autoAbortMs, onAutoAbort, onStateChange }, ref) {
  const initialElapsed = typeof persisted === "number" && persisted >= 0 ? persisted : 0;
  const [state, setState] = useState(initialElapsed > 0 ? "stopped" : "idle"); // "idle" | "running" | "stopped" | "aborted"
  const [start, setStart] = useState(null);
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [aborted, setAborted] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const autoAbortFiredRef = useRef(false);

  const abortAtLimit = useCallback((now) => {
    if (autoAbortFiredRef.current) return;
    autoAbortFiredRef.current = true;
    setElapsed(autoAbortMs);
    setState("aborted");
    setStart(null);
    setAborted(true);
    onStateChange?.("aborted");
    onPersist?.(autoAbortMs);
    onAutoAbort?.({ at: now, elapsedMs: autoAbortMs });
  }, [autoAbortMs, onStateChange, onPersist, onAutoAbort]);

  useClockRefresh(() => {
    if (state !== "running" || start === null || autoAbortFiredRef.current) return;
    const now = Date.now();
    const sample = readStopwatch(start, now, autoAbortMs);
    if (sample.limitReached) abortAtLimit(now);
    else setElapsed(sample.elapsedMs);
  }, state === "running" ? 50 : null);

  const onStart = () => {
    // Treat `start` as the origin for the accumulated elapsed time so a
    // stopped stopwatch resumes instead of beginning a new measurement.
    setStart(Date.now() - elapsed);
    setState("running");
    setAborted(false);
    autoAbortFiredRef.current = false;
    onStateChange?.("running");
  };
  const stopNow = useCallback(() => {
    if (autoAbortFiredRef.current) return;
    const now = Date.now();
    const sample = state === "running" && start !== null ? readStopwatch(start, now, autoAbortMs) : { elapsedMs: elapsed, limitReached: false };
    // A late scheduled update must never allow a manual/imperative stop to
    // bypass the automatic limit or save a measurement beyond that limit.
    if (sample.limitReached) { abortAtLimit(now); return; }
    const final = sample.elapsedMs;
    setElapsed(final);
    setState("stopped");
    setStart(null);
    onStateChange?.("stopped");
    if (onPersist) onPersist(final);
  }, [elapsed, onPersist, onStateChange, start, state, autoAbortMs, abortAtLimit]);
  const onStop = () => stopNow();
  const onReset = useCallback(() => {
    setState("idle");
    setStart(null);
    setElapsed(0);
    setAborted(false);
    autoAbortFiredRef.current = false;
    onStateChange?.("idle");
    if (onPersist) onPersist(0);
  }, [onPersist, onStateChange]);

  useImperativeHandle(ref, () => ({
    stop: () => stopNow(),
    stopIfRunning: () => {
      if (state === "running") stopNow();
    },
    reset: () => onReset(),
  }), [stopNow, onReset, state]);

  const limitSeconds = autoAbortMs ? Math.round(autoAbortMs / 1000) : null;

  return (
    <div className={`p-4 rounded-2xl border max-w-md ${aborted ? "border-rose-300 bg-rose-50" : "bg-white"}`}>
      <div className="text-4xl font-mono tabular-nums">{fmtMs(elapsed)}</div>
      {limitSeconds && (
        <div className="text-xs text-zinc-600 mt-1">Auto-Abbruch bei {limitSeconds}s</div>
      )}
      {aborted && (
        <div className="mt-2 text-sm font-medium text-rose-700">
          Automatischer Abbruch: Zeitlimit erreicht. Messwert wird nicht gespeichert.
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <Button
          onClick={state === "running" ? onStop : onStart}
          variant={state === "running" ? "secondary" : "primary"}
        >
          {state === "running" ? "Stopp" : "Start"}
        </Button>
        <Button onClick={() => setConfirmResetOpen(true)} variant="secondary">Reset</Button>
      </div>
      <ResetTimerConfirm
        open={confirmResetOpen}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          onReset();
        }}
      />
    </div>
  );
});

export function Countdown60({ disabled = false }) {
  const [state, setState] = useState("idle"); // "idle" | "running" | "stopped"
  const [t, setT] = useState(60_000);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const deadlineRef = useRef(null);
  const remainingRef = useRef(60_000);

  useClockRefresh(() => {
    if (deadlineRef.current === null) return;
    const remaining = remainingUntil(deadlineRef.current, Date.now());
    remainingRef.current = remaining;
    setT(remaining);
    if (remaining === 0) {
      deadlineRef.current = null;
      setState("stopped");
    }
  }, state === "running" ? 100 : null);

  const onStart = () => {
    if (remainingRef.current <= 0 || deadlineRef.current !== null) return;
    deadlineRef.current = Date.now() + remainingRef.current;
    setState("running");
  };
  const onStop = () => {
    // Recompute at the actual click, not from the last displayed value.
    if (deadlineRef.current !== null) remainingRef.current = remainingUntil(deadlineRef.current, Date.now());
    deadlineRef.current = null;
    setT(remainingRef.current);
    setState("stopped");
  };
  const onReset = () => {
    deadlineRef.current = null;
    remainingRef.current = 60_000;
    setState("idle");
    setT(60_000);
  };

  return (
    <div className="p-4 rounded-2xl border bg-white max-w-md">
      <div className="text-4xl font-mono tabular-nums">{fmtMs(t)}</div>
      <div className="flex gap-2 mt-3">
        {t > 0 ? (
          <Button
            onClick={state === "running" ? onStop : onStart}
            disabled={disabled}
            variant={state === "running" ? "secondary" : "primary"}
          >
            {state === "running" ? "Stopp" : "Start"}
          </Button>
        ) : (
          <Button disabled variant="secondary">Start</Button>
        )}
        <Button onClick={() => setConfirmResetOpen(true)} disabled={disabled} variant="secondary">Reset</Button>
      </div>
      <ResetTimerConfirm
        open={confirmResetOpen}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          onReset();
        }}
      />
    </div>
  );
}
