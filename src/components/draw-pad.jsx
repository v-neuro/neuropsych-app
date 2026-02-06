import React, { useEffect, useRef, useState } from "react";

// Touch/Apple Pencil friendly canvas (no undo/clear buttons)
export function DrawPad({ width = 800, height = 400, initialData, onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const ctxRef = useRef(null);

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
  }, [width, height]);

  // Render persisted image if provided (accepts DataURL or Blob/URL)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !initialData) return;
    const ctx = ctxRef.current || canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.drawImage(img, 0, 0, width, height);
      if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    };
    if (initialData instanceof Blob) {
      img.src = URL.createObjectURL(initialData);
    } else {
      img.src = initialData;
    }
  }, [initialData, width, height]);

  const emitChange = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
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
    emitChange();
  };

  return (
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
          onPointerLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          className="block"
          style={{ width: "100%", height }}
        />
      </div>
    </div>
  );
}
