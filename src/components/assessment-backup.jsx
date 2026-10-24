import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_BACKUP_BYTES, parseAssessmentBackup } from "../lib/assessment-backup";
import { ExportDialog } from "./export-dialog";
import { Button } from "./ui";

function BackupMenu({ onClose, onCreate, onLoad }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="backup-menu-title"
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl max-h-[85dvh] overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-lg backdrop:bg-black/50"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id="backup-menu-title" className="text-lg font-semibold">Vollständiges Backup</h2>
        <Button size="sm" onClick={onClose}>Schließen</Button>
      </div>
      <p>Testungsdaten, Zeichnungen, Erinnerungen und Testfortschritt sichern oder wiederherstellen.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onCreate}>Backup erstellen</Button>
        <Button size="sm" onClick={onLoad}>Backup laden</Button>
      </div>
    </dialog>, document.body
  );
}

function prepareBackupFile(exported) {
  if (!exported) return { file: null, share: false };
  const files = [
    new File([exported.json], `${exported.name}.npt-backup.json`, { type: "application/json" }),
    new File([exported.json], `${exported.name}.npt-backup.txt`, { type: "text/plain" }),
  ];
  for (const file of files) {
    try { if (navigator.share && navigator.canShare?.({ files: [file] })) return { file, share: true }; }
    catch { /* Try a plain-text backup if JSON sharing is unavailable. */ }
  }
  return { file: files[0], share: false };
}

export function AssessmentBackup({ onCreate, onRestore }) {
  const inputRef = useRef(null);
  const textRef = useRef(null);
  const requestRef = useRef(0);
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exported, setExported] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [feedback, setFeedback] = useState("");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || !!navigator.standalone;
  const prepared = useMemo(() => prepareBackupFile(exported), [exported]);

  const close = () => { requestRef.current++; setMode(null); setBusy(false); };
  const create = async () => {
    const request = ++requestRef.current;
    setMode("export"); setBusy(true); setFeedback(""); setExported(null);
    try {
      const result = await onCreate();
      if (request === requestRef.current) setExported(result);
    } catch (error) { if (request === requestRef.current) setFeedback(error.message || "Backup konnte nicht erstellt werden."); }
    finally { if (request === requestRef.current) setBusy(false); }
  };
  const load = async (file) => {
    if (!file) return;
    const request = ++requestRef.current;
    setMode("restore"); setBusy(true); setFeedback(""); setCandidate(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Das Backup ist größer als 128 MB.");
      const parsed = await parseAssessmentBackup(await file.text());
      if (request === requestRef.current) setCandidate(parsed);
    } catch (error) { if (request === requestRef.current) setFeedback(error.message || "Backup konnte nicht gelesen werden."); }
    finally { if (request === requestRef.current) setBusy(false); }
  };
  const save = async () => {
    setFeedback("");
    try {
      if (prepared.share) await navigator.share({ files: [prepared.file] });
      else if (standalone) {
        try { await navigator.clipboard.writeText(exported.json); setFeedback("Backup-Inhalt kopiert. Als Textdatei aufbewahren, um ihn später zu laden."); }
        catch {
          textRef.current.closest("details").open = true;
          textRef.current.focus(); textRef.current.select();
          setFeedback("Bitte den ausgewählten Backup-Inhalt kopieren und als Textdatei aufbewahren.");
        }
      } else {
        const url = URL.createObjectURL(prepared.file);
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = prepared.file.name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (error) { if (error.name !== "AbortError") setFeedback("Backup konnte nicht übergeben werden. Bitte erneut versuchen."); }
  };
  const restore = async () => {
    setRestoring(true); setFeedback("");
    try { await onRestore(candidate); }
    catch (error) { setFeedback(error.message || "Backup konnte nicht wiederhergestellt werden."); setRestoring(false); }
  };

  return (
    <>
      <Button variant="secondary" aria-haspopup="dialog" onClick={() => setMode("menu")}>Backup</Button>
      <input ref={inputRef} type="file" accept=".json,.txt,application/json,text/plain" hidden aria-label="Backup-Datei laden" onChange={(event) => {
        const file = event.target.files[0]; event.target.value = ""; void load(file);
      }} />
      {mode === "menu" && <BackupMenu onClose={close} onCreate={() => void create()} onLoad={() => inputRef.current.click()} />}
      {(mode === "export" || mode === "restore") && <ExportDialog id="npt-backup" title={mode === "export" ? "Backup sichern" : "Backup wiederherstellen"}
        filename={mode === "export" ? prepared.file?.name || "Backup" : "Backup wiederherstellen"} canClose={!restoring} onClose={close}
        actions={mode === "export" ? <Button variant="primary" disabled={!exported || busy} onClick={() => void save()}>
          {prepared.share ? "Backup teilen / In Dateien sichern" : standalone ? "Backup kopieren" : "Backup herunterladen"}
        </Button> : <Button variant="primary" disabled={!candidate || busy || restoring} onClick={() => void restore()}>
          {restoring ? "Backup wird wiederhergestellt …" : "Backup wiederherstellen"}
        </Button>}>
        {busy && <p role="status">{mode === "export" ? "Backup wird erstellt …" : "Backup wird geprüft …"}</p>}
        {feedback && <p role="status" className="mb-3">{feedback}</p>}
        {mode === "export" && exported && <>
          <h1 className="text-xl font-semibold">Backup sichern</h1>
          <p className="my-3">{prepared.file.name}</p>
          <p>Diese Datei enthält die vollständige aktuelle Testung einschließlich aller gespeicherten Zeichnungen.</p>
          <details className="mt-3"><summary>Backup-Inhalt</summary><textarea ref={textRef} readOnly value={exported.json} aria-label="Vollständiger Backup-Inhalt" rows={8} className="mt-2 w-full border bg-white p-2 text-xs text-slate-900" /></details>
        </>}
        {mode === "restore" && candidate && <>
          <h1 className="text-xl font-semibold">Backup wiederherstellen</h1>
          <dl className="my-3 grid grid-cols-2 gap-2">
            <dt>Initialen</dt><dd>{candidate.snapshot.sessionData.demographics?.patient_initials || "—"}</dd>
            <dt>Gesichert am</dt><dd>{new Date(candidate.createdAt).toLocaleString("de-DE")}</dd>
            <dt>Zeichnungen</dt><dd>{candidate.drawings.length}</dd>
          </dl>
          <p>Die aktuelle Testung wird durch dieses Backup ersetzt. Die gesicherte Ansicht und der Testfortschritt werden wiederhergestellt. Erinnerungsfristen laufen seit der Sicherung weiter.</p>
        </>}
      </ExportDialog>}
    </>
  );
}
