"use client";

import { useEffect, useState } from "react";
import { Eraser, StickyNote, X } from "lucide-react";

import { useMemoPad } from "@/components/app-shell/memo-pad-provider";
import { Button } from "@/components/ui/button";
import { useMemoPadStore } from "@/lib/memo-pad/use-memo-pad";

export function FloatingMemoPad() {
  const { open, close } = useMemoPad();
  const { content, updateContent, clearContent } = useMemoPadStore();
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    setSavedHint(true);
    const timer = window.setTimeout(() => setSavedHint(false), 1500);
    return () => window.clearTimeout(timer);
  }, [content, open]);

  if (!open) return null;

  function handleChange(value: string) {
    updateContent(value);
  }

  function handleClear() {
    if (content.trim() && !window.confirm("Clear all memo pad notes?")) return;
    clearContent();
  }

  const lineCount = content.trim() ? content.split("\n").length : 0;
  const charCount = content.length;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-[100] sm:bottom-6 sm:left-6"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl sm:w-[24rem]"
        role="dialog"
        aria-label="Memo pad"
      >
        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4" />
            Memo pad
          </div>
          <div className="flex items-center gap-1">
            {savedHint ? <span className="text-xs text-muted-foreground">Saved</span> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Clear memo pad"
              onClick={handleClear}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Close memo pad"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3">
          <textarea
            value={content}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Jot down notes, reminders, or quick calculations..."
            className="min-h-[220px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            spellCheck
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {lineCount} {lineCount === 1 ? "line" : "lines"} · {charCount} chars
            </span>
            <span>Auto-saved locally</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MemoPadToggleButton() {
  const { open, toggle } = useMemoPad();
  const { content } = useMemoPadStore();
  const hasNotes = content.trim().length > 0;

  return (
    <Button
      type="button"
      variant={open ? "secondary" : "ghost"}
      size="icon"
      aria-label={open ? "Hide memo pad" : "Open memo pad"}
      aria-pressed={open}
      className="relative shrink-0"
      onClick={toggle}
    >
      <StickyNote className="h-5 w-5" />
      {hasNotes && !open ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
      ) : null}
    </Button>
  );
}
