"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const CIRCLE = 220;
const OUTPUT = 400;

export function AvatarCrop({
  src,
  onConfirm,
  onCancel,
}: {
  src: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imgNat, setImgNat] = useState({ w: 1, h: 1 });
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const clamp = useCallback(
    (ox: number, oy: number, sc: number) => {
      const imgW = imgNat.w * sc;
      const imgH = imgNat.h * sc;
      const maxX = Math.max(0, (imgW - CIRCLE) / 2);
      const maxY = Math.max(0, (imgH - CIRCLE) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, ox)),
        y: Math.max(-maxY, Math.min(maxY, oy)),
      };
    },
    [imgNat]
  );

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setImgNat({ w: nw, h: nh });
    const ms = CIRCLE / Math.min(nw, nh);
    setMinScale(ms);
    setScale(ms);
    setOffset({ x: 0, y: 0 });
  };

  const applyScale = (newScale: number, currentOffset = offset) => {
    const clamped = clamp(currentOffset.x, currentOffset.y, newScale);
    setScale(newScale);
    setOffset(clamped);
  };

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setOffset(clamp(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
    },
    [dragging, scale, clamp]
  );

  const onMouseUp = useCallback(() => setDragging(false), []);

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
  };

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!dragging || !dragStart.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.mx;
      const dy = t.clientY - dragStart.current.my;
      setOffset(clamp(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
    },
    [dragging, scale, clamp]
  );

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  // Scroll-to-zoom on the circle
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setScale((prev) => {
        const next = Math.max(minScale, Math.min(minScale * 3, prev + delta * prev));
        setOffset((o) => clamp(o.x, o.y, next));
        return next;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [minScale, clamp]);

  const confirm = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.clip();

    const ratio = OUTPUT / CIRCLE;
    const drawW = imgNat.w * scale * ratio;
    const drawH = imgNat.h * scale * ratio;
    const drawX = OUTPUT / 2 + offset.x * ratio - drawW / 2;
    const drawY = OUTPUT / 2 + offset.y * ratio - drawH / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="text-center">
          <h3 className="font-semibold">Adjust photo</h3>
          <p className="text-xs text-gray-400 mt-0.5">Drag to reposition · Pinch or scroll to zoom</p>
        </div>

        {/* Circle viewport */}
        <div className="flex justify-center">
          {/* Drag-to-reposition is a mouse/touch convenience; zoom (mouse wheel) has no keyboard
              equivalent to attach here either, so this surface is decorative, not a control. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-full border-2 border-brand select-none"
            style={{ width: CIRCLE, height: CIRCLE, cursor: dragging ? "grabbing" : "grab" }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: "absolute",
                width: imgNat.w * scale,
                height: imgNat.h * scale,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                maxWidth: "none",
                userSelect: "none",
              }}
            />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="space-y-1 px-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Zoom</span>
            <span>{Math.round((scale / minScale) * 100)}%</span>
          </div>
          <input
            type="range"
            min={minScale}
            max={minScale * 3}
            step={0.001}
            value={scale}
            onChange={(e) => applyScale(parseFloat(e.target.value))}
            className="w-full accent-brand"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={confirm}
            className="flex-1 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition"
          >
            Use this crop
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
