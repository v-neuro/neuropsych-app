import React, { useEffect, useRef, useState } from "react";

// Touch/Apple Pencil friendly canvas
export function DrawPad({ width = 800, height = 400, initialData, onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !initialData) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = initialData;
  }, [initialData, width, height]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches?.[0]?.clientX ?? 0)) - rect.left;
    const y = (e.clientY || (e.touches?.[0]?.clientY ?? 0)) - rect.top;
    return { x, y };
  };

  const start = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    const data = canvasRef.current.toDataURL("image/png");
    onChange && onChange(data);
  };
  const clear = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange && onChange("");
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
      <button type="button" onClick={clear} className="px-3 py-1.5 rounded-xl border text-sm">
        Zeichnung löschen
      </button>
    </div>
  );
}
