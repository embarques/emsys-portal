"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible label for the drawing surface. */
  "aria-label"?: string;
};

/**
 * Pointer-driven signature capture (mouse + touch). Emits a PNG data URL.
 */
export function SignaturePad({
  value,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;
      const previous = canvas.toDataURL("image/png");
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2.25;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (value || dirtyRef.current) {
        const image = new Image();
        image.onload = () => {
          ctx.drawImage(image, 0, 0, width, height);
        };
        image.src = value || previous;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [value]);

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const point = pointerPosition(event);
    if (!point) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    dirtyRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const point = pointerPosition(event);
    const last = lastPointRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!point || !last || !ctx) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released.
    }
    const dataUrl = canvasRef.current?.toDataURL("image/png") ?? null;
    onChange(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    dirtyRef.current = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    onChange(null);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          "h-40 w-full touch-none rounded-lg border border-border bg-white",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair",
        )}
        aria-label={ariaLabel ?? t("invoices.wizard.policies.signatureLabel")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={(event) => {
          if (drawingRef.current) finishStroke(event);
        }}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" disabled={disabled || !value} onClick={clear}>
          {t("invoices.wizard.policies.clearSignature")}
        </Button>
      </div>
    </div>
  );
}
