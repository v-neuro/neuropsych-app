import { useEffect, useRef, useState } from "react";
import { ExportDialog } from "./export-dialog";
import { Button } from "./ui";

export function PdfExportPreview({ preview, onClose }) {
  const reportRef = useRef(null);
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    if (!preview.content) return;
    let cancelled = false;
    const images = [...reportRef.current.querySelectorAll("img")];
    void Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    }))).then(() => { if (!cancelled) setImagesReady(true); });
    return () => { cancelled = true; };
  }, [preview.content]);

  return (
    <ExportDialog id="npt-pdf-export" title="PDF-Export" filename={`${preview.filename}.pdf`} printable onClose={onClose} actions={
      <Button variant="primary" disabled={!preview.content || !imagesReady} onClick={() => window.print()}>
        Drucken / Als PDF sichern
      </Button>
    }>
      <style>{preview.style}</style>
      {preview.error ? <p role="alert">PDF-Export fehlgeschlagen. Bitte zur Testung zurückkehren und erneut versuchen.</p>
        : !preview.content ? <p role="status">PDF-Export wird vorbereitet …</p>
          : <div className="npt-pdf-report" ref={reportRef} dangerouslySetInnerHTML={{ __html: preview.content }} />}
    </ExportDialog>
  );
}
