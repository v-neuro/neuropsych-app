import { useMemo, useRef, useState } from "react";
import { ExportDialog } from "./export-dialog";
import { Button } from "./ui";

export function CsvExportPreview({ preview, onClose }) {
  const textRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const file = useMemo(() => new File([preview.csv], preview.filename, { type: "text/csv" }), [preview.csv, preview.filename]);
  const canShare = useMemo(() => {
    try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }); }
    catch { return false; }
  }, [file]);

  const share = async () => {
    setSharing(true);
    setFeedback("");
    try {
      // Invoke from this click, with the File already prepared, to retain user activation.
      await navigator.share({ files: [file] });
      setFeedback("CSV geteilt.");
    } catch (error) {
      if (error.name !== "AbortError") setFeedback("Teilen nicht möglich. Bitte erneut versuchen oder den CSV-Inhalt kopieren.");
    } finally {
      setSharing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preview.csv);
      setFeedback("CSV-Inhalt kopiert.");
    } catch {
      textRef.current.focus();
      textRef.current.select();
      setFeedback("Bitte den ausgewählten CSV-Inhalt über „Kopieren“ übernehmen.");
    }
  };

  return (
    <ExportDialog id="npt-csv-export" title="CSV-Export" filename={preview.filename} onClose={onClose} actions={
      <div className="flex flex-wrap gap-2">
        {canShare && <Button variant="primary" disabled={sharing} onClick={share}>CSV teilen / In Dateien sichern</Button>}
        <Button onClick={copy}>CSV kopieren</Button>
      </div>
    }>
      <h1 className="text-xl font-semibold">CSV-Export</h1>
      <p className="my-2 break-all text-sm">{preview.filename}</p>
      <p className="mb-3 text-sm">{canShare
        ? "Im Teilen-Menü „In Dateien sichern“ wählen, um die CSV-Datei zu speichern."
        : "Dateien können auf diesem Gerät nicht direkt geteilt werden. Den CSV-Inhalt kopieren, um ihn weiterzuverwenden."}</p>
      <label htmlFor="npt-csv-content" className="block text-sm font-medium">CSV-Inhalt</label>
      <textarea id="npt-csv-content" ref={textRef} readOnly value={preview.csv} spellCheck={false} wrap="off" rows={12}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900" />
      <p role="status" className="mt-2 text-sm">{feedback}</p>
    </ExportDialog>
  );
}
