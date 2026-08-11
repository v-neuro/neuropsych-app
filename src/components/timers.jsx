import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { useInterval } from "../lib/utils";
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

const StopwatchState = forwardRef(function StopwatchState({ persisted, onPersist, autoAbortMs, onAutoAbort }, ref) {
  const initialElapsed = typeof persisted === "number" && persisted >= 0 ? persisted : 0;
  const [state, setState] = useState(initialElapsed > 0 ? "stopped" : "idle"); // "idle" | "running" | "stopped" | "aborted"
  const [start, setStart] = useState(null);
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [aborted, setAborted] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const autoAbortFiredRef = useRef(false);

  useInterval(() => {
    if (state !== "running" || start === null) return;

    const now = Date.now();
    const nextElapsed = now - start;
    if (autoAbortMs && !autoAbortFiredRef.current && nextElapsed >= autoAbortMs) {
      autoAbortFiredRef.current = true;
      setElapsed(autoAbortMs);
      setState("aborted");
      setStart(null);
      setAborted(true);
      onPersist?.(autoAbortMs);
      onAutoAbort?.({ at: now, elapsedMs: autoAbortMs });
      return;
    }
    setElapsed(nextElapsed);
  }, 50);

  const onStart = () => {
    setStart(Date.now());
    setElapsed(0);
    setState("running");
    setAborted(false);
    autoAbortFiredRef.current = false;
  };
  const stopNow = useCallback(() => {
    const final = state === "running" && start !== null ? Date.now() - start : elapsed;
    setElapsed(final);
    setState("stopped");
    setStart(null);
    if (onPersist) onPersist(final);
  }, [elapsed, onPersist, start, state]);
  const onStop = () => stopNow();
  const onReset = useCallback(() => {
    setState("idle");
    setStart(null);
    setElapsed(0);
    setAborted(false);
    autoAbortFiredRef.current = false;
    if (onPersist) onPersist(0);
  }, [onPersist]);

  useImperativeHandle(ref, () => ({
    stop: () => stopNow(),
    reset: () => onReset(),
  }), [stopNow, onReset]);

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

  useInterval(() => {
    if (state === "running" && t > 0) setT((x) => Math.max(0, x - 100));
  }, 100);

  const onStart = () => setState("running");
  const onStop = () => setState("stopped");
  const onReset = () => { setState("idle"); setT(60_000); };

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
