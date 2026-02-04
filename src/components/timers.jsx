import React, { useEffect, useState } from "react";
import { useInterval } from "../lib/utils";

function fmtMs(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

export function Stopwatch({ persisted, onPersist }) {
  const [state, setState] = useState("idle"); // "idle" | "running" | "stopped"
  const [start, setStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (typeof persisted === "number" && persisted >= 0 && persisted !== elapsed) {
      setElapsed(persisted);
      setState("stopped");
      setStart(null);
    }
  }, [persisted, elapsed]);

  useInterval(() => {
    if (state === "running" && start !== null) setElapsed(Date.now() - start);
  }, 50);

  const onStart = () => {
    setStart(Date.now());
    setElapsed(0);
    setState("running");
  };
  const onStop = () => {
    setState("stopped");
    if (onPersist) onPersist(elapsed);
  };
  const onReset = () => {
    setState("idle");
    setStart(null);
    setElapsed(0);
    if (onPersist) onPersist(0);
  };

  return (
    <div className="p-4 rounded-2xl border bg-white max-w-md">
      <div className="text-4xl font-mono tabular-nums">{fmtMs(elapsed)}</div>
      <div className="flex gap-2 mt-3">
        {state === "idle" && (
          <button onClick={onStart} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">Start</button>
        )}
        {state === "running" && (
          <button onClick={onStop} className="px-3 py-2 rounded-xl border">Stopp</button>
        )}
        {state !== "running" && (
          <button onClick={onReset} className="px-3 py-2 rounded-xl border">Reset</button>
        )}
      </div>
    </div>
  );
}

export function Countdown60() {
  const [state, setState] = useState("idle"); // "idle" | "running" | "stopped"
  const [t, setT] = useState(60_000);

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
        {state !== "running" && t > 0 && (
          <button onClick={onStart} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">Start</button>
        )}
        {state === "running" && (
          <button onClick={onStop} className="px-3 py-2 rounded-xl border">Stopp</button>
        )}
        {state !== "running" && (
          <button onClick={onReset} className="px-3 py-2 rounded-xl border">Reset</button>
        )}
      </div>
    </div>
  );
}
