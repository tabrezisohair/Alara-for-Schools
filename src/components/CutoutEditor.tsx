"use client";

import { useEffect, useRef, useState } from "react";

export function CutoutEditor({
  src,
  onCancel,
  onReady,
}: {
  src: string;
  onCancel: () => void;
  onReady: (markedDataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<"remove" | "keep">("remove");
  const [brush, setBrush] = useState<"s" | "m" | "l">("m");
  const [hasMark, setHasMark] = useState(false);
  const painting = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      setNatural({ w, h });
      const mask = document.createElement("canvas");
      mask.width = w;
      mask.height = h;
      maskRef.current = mask;
      setHasMark(false);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    redraw();
  }, [natural, hasMark]);

  function brushRadius() {
    const unit = Math.min(natural.w, natural.h);
    if (brush === "s") return unit * 0.018;
    if (brush === "l") return unit * 0.07;
    return unit * 0.038;
  }

  function toPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = displayRef.current;
    if (!canvas || !natural.w) return null;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * natural.w,
      y: ((event.clientY - box.top) / box.height) * natural.h,
    };
  }

  function stamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, brushRadius(), 0, Math.PI * 2);
    ctx.fill();
  }

  function paintAt(x: number, y: number) {
    const mask = maskRef.current;
    const ctx = mask?.getContext("2d");
    if (!mask || !ctx) return;
    ctx.save();
    ctx.globalCompositeOperation =
      tool === "remove" ? "source-over" : "destination-out";
    ctx.fillStyle = "#ff008c";
    const prev = lastPoint.current;
    if (prev) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (brushRadius() * 0.4)));
      for (let i = 1; i <= steps; i++) {
        stamp(ctx, prev.x + (dx * i) / steps, prev.y + (dy * i) / steps);
      }
    } else {
      stamp(ctx, x, y);
    }
    ctx.restore();
    lastPoint.current = { x, y };
    setHasMark(maskHasPaint());
    redraw();
  }

  function maskHasPaint() {
    const mask = maskRef.current;
    const ctx = mask?.getContext("2d", { willReadFrequently: true });
    if (!mask || !ctx) return false;
    const { data } = ctx.getImageData(0, 0, mask.width, mask.height);
    for (let i = 3; i < data.length; i += 64) {
      if (data[i] > 8) return true;
    }
    return false;
  }

  function redraw() {
    const canvas = displayRef.current;
    const img = imgRef.current;
    const mask = maskRef.current;
    if (!canvas || !img || !natural.w) return;
    if (canvas.width !== natural.w) canvas.width = natural.w;
    if (canvas.height !== natural.h) canvas.height = natural.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (mask) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = toPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    painting.current = true;
    lastPoint.current = null;
    paintAt(point.x, point.y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!painting.current) return;
    const point = toPoint(event);
    if (point) paintAt(point.x, point.y);
  }

  function onPointerUp() {
    painting.current = false;
    lastPoint.current = null;
  }

  function clearMarks() {
    const mask = maskRef.current;
    const ctx = mask?.getContext("2d");
    if (mask && ctx) ctx.clearRect(0, 0, mask.width, mask.height);
    lastPoint.current = null;
    setHasMark(false);
    redraw();
  }

  function exportMarked() {
    const canvas = displayRef.current;
    if (!canvas) return;
    onReady(canvas.toDataURL("image/jpeg", 0.9));
  }

  return (
    <section className="card space-y-4">
      <h2 className="font-medium">Mark what should be removed</h2>
      <p className="text-sm text-[var(--muted)]">
        Paint over the background — and anyone you do not want on the post.
        Pink means “take this out.” Leave the person you want unpainted.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tool === "remove" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTool("remove")}
        >
          Mark to remove
        </button>
        <button
          type="button"
          className={tool === "keep" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTool("keep")}
        >
          Unmark
        </button>
        <span className="self-center text-sm text-[var(--muted)]">Brush</span>
        {(["s", "m", "l"] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={brush === size ? "btn-primary" : "btn-secondary"}
            onClick={() => setBrush(size)}
          >
            {size === "s" ? "Small" : size === "m" ? "Medium" : "Large"}
          </button>
        ))}
        <button type="button" className="btn-secondary" onClick={clearMarks}>
          Clear marks
        </button>
      </div>
      <div className="flex min-h-[12rem] justify-center overflow-auto rounded-2xl bg-[var(--navy)] p-3">
        {natural.w ? (
          <canvas
            ref={displayRef}
            className="cursor-crosshair touch-none"
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "70vh",
              aspectRatio: `${natural.w} / ${natural.h}`,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        ) : (
          <p className="self-center text-sm text-white/80">Loading photo…</p>
        )}
      </div>
      <p className="text-sm text-[var(--navy)]">
        Pink areas are removed. Faces you leave unpainted stay as photographed.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!hasMark}
          onClick={exportMarked}
        >
          Create the post
        </button>
      </div>
    </section>
  );
}
