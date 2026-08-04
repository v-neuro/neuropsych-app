import React from "react";
import { Button } from "./ui";

export function CounterCard({ label, value, onDec }) {
  return (
    <div className="p-3 rounded-xl border bg-zinc-50 flex items-center justify-between">
      <div>
        <div className="text-xs text-zinc-600">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </div>
      <Button
        type="button"
        onClick={onDec}
        size="sm"
        variant="secondary"
        className="text-xs"
        disabled={value === 0}
      >
        −1
      </Button>
    </div>
  );
}
