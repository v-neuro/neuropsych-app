import React, { useState } from "react";
import { Button } from "./ui";

export function AbortButton({
  onAbort,
  children = "Testabbruch",
  defaultReasonType = "",
  defaultNote = "",
  variant = "danger",
  size = "sm",
}) {
  const [open, setOpen] = useState(false);
  const [reasonType, setReasonType] = useState(defaultReasonType);
  const [note, setNote] = useState(defaultNote);
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
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setReasonType(defaultReasonType);
          setNote(defaultNote);
          setOpen(true);
        }}
      >
        {children}
      </Button>
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
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  setReasonType(defaultReasonType);
                  setNote(defaultNote);
                }}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  onAbort && onAbort({
                    reason: reasonType || "Abbruch",
                    note,
                    at: Date.now(),
                  });
                  setOpen(false);
                  setReasonType(defaultReasonType);
                  setNote(defaultNote);
                }}
              >
                Beenden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
