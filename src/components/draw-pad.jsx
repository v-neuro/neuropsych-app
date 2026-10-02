import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

const EMPTY_FIGURES = [];

function drawStroke(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

// One raster base for reopened drawings, plus small point arrays for new strokes.
// No synchronous PNG encoding or full-image copy is needed while drawing/undoing.
export function DrawPad({ width = 800, height = 400, initialData, onChange, savedFigures = EMPTY_FIGURES, onSaveFigure, showSaveFigureButton = true }) {
  const canvasRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const baseHasInkRef = useRef(false);
  const strokesRef = useRef([]);
  const activeStrokeRef = useRef(null);
  const pointerRef = useRef(null);
  const loadingRef = useRef(false);
  const revisionRef = useRef(0);
  const lastEmittedBlobRef = useRef(undefined);
  const [hasInk, setHasInk] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState([]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (baseCanvasRef.current) ctx.drawImage(baseCanvasRef.current, 0, 0);
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const base = document.createElement("canvas");
    base.width = canvas.width;
    base.height = canvas.height;
    baseCanvasRef.current = base;
    baseHasInkRef.current = false;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    pointerRef.current = null;
    redraw();
  }, [width, height, redraw]);

  useEffect(() => {
    // An emitted Blob returning through persistence must not erase undo history.
    if (initialData === lastEmittedBlobRef.current) return;
    revisionRef.current++;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    pointerRef.current = null;
    const canvas = canvasRef.current;
    const base = baseCanvasRef.current;
    const baseCtx = base.getContext("2d");
    baseCtx.clearRect(0, 0, base.width, base.height);
    let cancelled = false;
    const finish = (ink) => {
      if (cancelled) return;
      baseHasInkRef.current = ink;
      loadingRef.current = false;
      redraw();
      setHasInk(ink);
      setUndoDepth(0);
    };
    if (!initialData) {
      loadingRef.current = true;
      redraw();
      const frame = requestAnimationFrame(() => finish(false));
      return () => { cancelled = true; cancelAnimationFrame(frame); };
    }
    loadingRef.current = true;
    const objectUrl = initialData instanceof Blob ? URL.createObjectURL(initialData) : null;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      baseCtx.drawImage(img, 0, 0, base.width, base.height);
      // Inspect transparency once on load, not on every stroke. This also
      // recognizes legacy saved blank PNGs without comparing encoded strings.
      const pixels = baseCtx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = false;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 0) { ink = true; break; }
      }
      finish(ink);
    };
    img.onerror = () => finish(false);
    img.src = objectUrl || initialData;
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [initialData, width, height, redraw]);

  useEffect(() => {
    const urlsToRevoke = [];
    const next = savedFigures.map((val) => {
      if (val instanceof Blob) {
        const url = URL.createObjectURL(val);
        urlsToRevoke.push(url);
        return url;
      }
      return val;
    }).filter(Boolean);
    const frame = requestAnimationFrame(() => setGalleryPreviewUrls(next));
    return () => {
      cancelAnimationFrame(frame);
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [savedFigures]);

  const emitChange = () => {
    const revision = ++revisionRef.current;
    if (!onChange) return;
    if (!baseHasInkRef.current && strokesRef.current.length === 0) {
      lastEmittedBlobRef.current = null;
      onChange(null);
      return;
    }
    // Only the latest asynchronous encode may update the persisted drawing.
    canvasRef.current.toBlob((blob) => {
      if (!blob || revision !== revisionRef.current) return;
      lastEmittedBlobRef.current = blob;
      onChange(blob);
    }, "image/png");
  };

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height };
  };

  const start = (event) => {
    if (loadingRef.current || activeStrokeRef.current || event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    activeStrokeRef.current = [point(event)];
    pointerRef.current = event.pointerId;
    // Pointer capture also delivers Pencil/touch releases outside the canvas.
    canvasRef.current.setPointerCapture(event.pointerId);
  };

  const move = (event) => {
    const stroke = activeStrokeRef.current;
    if (!stroke || event.pointerId !== pointerRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const samples = event.nativeEvent.getCoalescedEvents?.() || [];
    for (const sample of samples.length ? samples : [event]) {
      const next = point(sample);
      const previous = stroke[stroke.length - 1];
      if (previous.x === next.x && previous.y === next.y) continue;
      // Paint only the new segment, not the entire growing path on every move.
      drawStroke(ctx, [previous, next]);
      stroke.push(next);
    }
  };

  const end = (event) => {
    if (!activeStrokeRef.current || event.pointerId !== pointerRef.current) return;
    if (event.type === "pointerup") move(event);
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    pointerRef.current = null;
    if (stroke.length < 2) return;
    strokesRef.current.push(stroke);
    setUndoDepth(strokesRef.current.length);
    setHasInk(true);
    emitChange();
  };

  const undo = () => {
    if (!strokesRef.current.length || activeStrokeRef.current) return;
    strokesRef.current.pop();
    redraw();
    setUndoDepth(strokesRef.current.length);
    setHasInk(baseHasInkRef.current || strokesRef.current.length > 0);
    emitChange();
  };

  const saveFigure = () => {
    if (!hasInk || activeStrokeRef.current) return;
    canvasRef.current.toBlob((blob) => { if (blob) onSaveFigure?.(blob); }, "image/png");
    baseCanvasRef.current.getContext("2d").clearRect(0, 0, baseCanvasRef.current.width, baseCanvasRef.current.height);
    baseHasInkRef.current = false;
    strokesRef.current = [];
    redraw();
    setUndoDepth(0);
    setHasInk(false);
    emitChange();
  };

  return (
    <div className="space-y-2">
      {galleryPreviewUrls.length > 0 && <div className="flex flex-wrap gap-2">
        {galleryPreviewUrls.map((src, idx) => <img key={`saved-figure-${idx}`} src={src} alt={`Gespeicherte Figur ${idx + 1}`} className="w-24 h-auto rounded-lg border bg-white" />)}
      </div>}
      <div className="space-y-2">
        <div className="rounded-xl border overflow-hidden bg-white touch-none" style={{ width, maxWidth: "100%" }}>
          <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
            className="block" aria-label="Zeichenfläche" style={{ width: "100%", height }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={undo} disabled={undoDepth === 0} size="sm" variant="secondary">Rückgängig</Button>
          {showSaveFigureButton && <Button type="button" onClick={saveFigure} disabled={!hasInk} size="sm" variant="secondary">Figur speichern</Button>}
        </div>
      </div>
    </div>
  );
}
