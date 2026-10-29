"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

const trackClassName = "flex w-full min-w-0 items-stretch gap-1 rounded-lg border border-input bg-muted p-1";

const segmentClassName =
  "min-w-0 flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm aria-[checked=false]:text-muted-foreground aria-[checked=false]:enabled:hover:text-foreground";
type SegmentedControlProps<T extends string> = {
  id?: string;
  value: T;
  options: SegmentedControlOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** Single-choice segments (radio group) with arrow-key selection. */
export function SegmentedControl<T extends string>({
  id,
  value,
  options,
  onValueChange,
  disabled = false,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabledIndexes = options.flatMap((option, index) => (disabled || option.disabled ? [] : [index]));
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? 0);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step || enabledIndexes.length === 0) return;
    event.preventDefault();
    const position = enabledIndexes.indexOf(index);
    const nextIndex = enabledIndexes[(position + step + enabledIndexes.length) % enabledIndexes.length];
    buttonRefs.current[nextIndex]?.focus();
    onValueChange(options[nextIndex].value);
  }

  return (
    <div id={id} role="radiogroup" aria-disabled={disabled || undefined} className={cn(trackClassName, className)} {...aria}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            id={id ? `${id}-${option.value}` : undefined}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => {
              if (!selected) onValueChange(option.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={segmentClassName}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
