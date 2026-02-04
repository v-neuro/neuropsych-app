import React from "react";

export function CounterCard({ label, value, onDec }) {
  return (
    <div className="p-3 rounded-xl border bg-zinc-50 flex items-center justify-between">
      <div>
        <div className="text-xs text-zinc-600">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </div>
      <button
        type="button"
        onClick={onDec}
        className="px-3 py-1.5 rounded-xl border text-xs bg-white"
        disabled={value === 0}
      >
        −1
      </button>
    </div>
  );
}
