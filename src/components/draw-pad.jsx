import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

// Touch/Apple Pencil friendly canvas with stroke-level undo
export function DrawPad({ width = 800, height = 400, initialData, onChange, savedFigures = [], onSaveFigure, showSaveFigureButton = true }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const ctxRef = useRef(null);
  const strokeBaseRef = useRef(null);
  const lastEmittedBlobRef = useRef(null);
  const blankSnapshotRef = useRef(null);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState([]);

  const drawImageOnCanvas = useCallback((src, onDone) => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const ctx = ctxRef.current || canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.drawImage(img, 0, 0, width, height);
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      if (onDone) onDone();
    };
    img.src = src;
  }, [height, width]);

  const snapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  const isBlankSnapshot = (dataUrl) => {
    if (!dataUrl || !blankSnapshotRef.current) return false;
    return dataUrl === blankSnapshotRef.current;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = ctxRef.current || canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  // Setup canvas for HiDPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctxRef.current = ctx;
    blankSnapshotRef.current = snapshot();
  }, [width, height]);

  // Render persisted image if provided (accepts DataURL or Blob/URL)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !initialData) return;
    // Ignore round-trip updates that came from this canvas itself.
    if (initialData === lastEmittedBlobRef.current) return;
    const src = initialData instanceof Blob ? URL.createObjectURL(initialData) : initialData;
    drawImageOnCanvas(src, () => {
      const snap = snapshot();
      setHasInk(!isBlankSnapshot(snap));
      setUndoStack([]);
    });
  }, [drawImageOnCanvas, initialData, width, height]);

  useEffect(() => {
    const urlsToRevoke = [];
    const next = (Array.isArray(savedFigures) ? savedFigures : []).map((val) => {
      if (val instanceof Blob) {
        const url = URL.createObjectURL(val);
        urlsToRevoke.push(url);
        return url;
      }
      return val;
    }).filter(Boolean);
    const frameId = requestAnimationFrame(() => setGalleryPreviewUrls(next));
    return () => {
      cancelAnimationFrame(frameId);
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [savedFigures]);

  const emitChange = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      lastEmittedBlobRef.current = blob;
      onChange(blob);
    }, "image/png");
  };

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches?.[0]?.clientX ?? 0)) - rect.left;
    const y = (e.clientY || (e.touches?.[0]?.clientY ?? 0)) - rect.top;
    return { x, y };
  };

  const start = (e) => {
    e.preventDefault();
    const ctx = ctxRef.current || canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    strokeBaseRef.current = snapshot();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = ctxRef.current || canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    const before = strokeBaseRef.current;
    strokeBaseRef.current = null;
    const after = snapshot();
    if (before && after && before !== after) {
      setUndoStack((prev) => [...prev, before]);
    }
    setHasInk(!isBlankSnapshot(after));
    emitChange();
  };

  const undo = () => {
    if (!undoStack.length) return;
    setUndoStack((prev) => {
      const next = prev.slice(0, -1);
      const prior = prev[prev.length - 1];
      drawImageOnCanvas(prior, () => {
        setHasInk(!isBlankSnapshot(prior));
        emitChange();
      });
      return next;
    });
  };

  const saveFigure = () => {
    if (!hasInk) return;
    const canvas = canvasRef.current;
    const snap = snapshot();
    if (!snap || isBlankSnapshot(snap) || !canvas) return;
    canvas.toBlob((blob) => {
      if (blob && onSaveFigure) onSaveFigure(blob);
    }, "image/png");
    clearCanvas();
    setUndoStack([]);
    strokeBaseRef.current = null;
    setDrawing(false);
    setHasInk(false);
    emitChange();
  };

  return (
    <div className="space-y-2">
      {galleryPreviewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {galleryPreviewUrls.map((src, idx) => (
            <img
              key={`saved-figure-${idx}`}
              src={src}
              alt={`Gespeicherte Figur ${idx + 1}`}
              className="w-24 h-auto rounded-lg border bg-white"
            />
          ))}
        </div>
      )}
      <div className="space-y-2">
        <div
          className="rounded-xl border overflow-hidden bg-white touch-none"
          style={{ width, maxWidth: "100%" }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
            onTouchCancel={end}
            className="block"
            style={{ width: "100%", height }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            size="sm"
            variant="secondary"
          >
            Rückgängig
          </Button>
          {showSaveFigureButton && (
            <Button
              type="button"
              onClick={saveFigure}
              disabled={!hasInk}
              size="sm"
              variant="secondary"
            >
              Figur speichern
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
