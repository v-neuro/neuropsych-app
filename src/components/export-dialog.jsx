import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";
import "./export-preview.css";

export function ExportDialog({ id, title, filename, printable = false, onClose, actions, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousTitle = document.title;
    const previousOverflow = document.body.style.overflow;
    document.title = filename;
    document.body.style.overflow = "hidden";
    if (printable) document.body.classList.add("npt-print-preview");
    dialog.showModal();
    return () => {
      dialog.close();
      document.title = previousTitle;
      document.body.style.overflow = previousOverflow;
      if (printable) document.body.classList.remove("npt-print-preview");
    };
  }, [filename, printable]);

  return createPortal(
    <dialog id={id} className="npt-export-preview" ref={dialogRef} aria-label={title} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <div className="npt-export-layout">
        <div className="npt-export-toolbar">
          <Button onClick={onClose}>← Zurück zur Testung</Button>
          {actions}
        </div>
        <div className="npt-export-scroll">{children}</div>
      </div>
    </dialog>,
    document.body
  );
}
