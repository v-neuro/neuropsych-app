import React, { useState } from "react";

export function AbortButton({ onAbort }) {
  const [open, setOpen] = useState(false);
  const [reasonType, setReasonType] = useState("");
  const [note, setNote] = useState("");
  const reasons = [
    "Patientenwunsch",
    "Instruktion unklar / nicht verstanden",
    "Seh-/Hörproblem",
    "Technisches Problem",
    "Abbruchkriterium erreicht",
    "Sonstiges",
  ];
  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-600"
      >
        Testabbruch
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="w-[520px] max-w-[95vw] p-4 rounded-2xl border bg-white shadow-lg">
            <div className="text-lg font-medium mb-2">Test wirklich beenden?</div>
            <label className="block text-sm">Grund</label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 bg-white"
            >
              <option value="">Bitte wählen …</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <label className="block text-sm mt-3">Notiz (optional)</label>
            <textarea
              value={note}
              onChange={(e)=>setNote(e.target.value)}
              className="mt-1 w-full h-24 rounded-xl border p-2"
              placeholder="z. B. Instruktion unklar, Farbenblindheit …"
            />
            <div className="flex gap-2 justify-end mt-3">
              <button
                onClick={() => {
                  setOpen(false);
                  setReasonType("");
                  setNote("");
                }}
                className="px-3 py-2 rounded-xl border"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  onAbort && onAbort({
                    reason: reasonType || "Abbruch",
                    note,
                    at: Date.now(),
                  });
                  setOpen(false);
                  setReasonType("");
                  setNote("");
                }}
                className="px-3 py-2 rounded-xl bg-rose-600 text-white"
              >
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
