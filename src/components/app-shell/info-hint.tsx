"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ActiveHint = { id: string; pinned: boolean } | null;

const AUTO_DISMISS_MS = 4000;

/** Only one hint may be open at a time; opening another replaces it. */
let activeHint: ActiveHint = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setActiveHint(next: ActiveHint) {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = next ? setTimeout(() => setActiveHint(null), AUTO_DISMISS_MS) : null;
  activeHint = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => activeHint;
const getServerSnapshot = (): ActiveHint => null;

type InfoHintProps = {
  message: string;
  label: string;
  className?: string;
};

/** Info icon that reveals `message` on hover/focus or click/tap, auto-dismissing after a few seconds. */
export function InfoHint({ message, label, className }: InfoHintProps) {
  const id = useId();
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = active?.id === id;

  useEffect(() => () => {
    if (activeHint?.id === id) setActiveHint(null);
  }, [id]);

  const preview = () => {
    if (activeHint?.id !== id) setActiveHint({ id, pinned: false });
  };
  const endPreview = () => {
    if (activeHint?.id === id && !activeHint.pinned) setActiveHint(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && activeHint?.id === id) setActiveHint(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className,
          )}
          onMouseEnter={preview}
          onMouseLeave={endPreview}
          onFocus={preview}
          onBlur={endPreview}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setActiveHint(activeHint?.id === id && activeHint.pinned ? null : { id, pinned: true });
          }}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-64 px-3 py-2 text-sm leading-snug"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {message}
      </PopoverContent>
    </Popover>
  );
}
