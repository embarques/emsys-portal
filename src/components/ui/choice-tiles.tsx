"use client";

import * as React from "react";
import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChoiceTileOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconBackgroundClassName?: string;
  disabled?: boolean;
};

type ChoiceTilesProps<T extends string> = {
  id?: string;
  /** `null` while nothing has been chosen yet. */
  value: T | null;
  options: ChoiceTileOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** Single choice shown as large tiles (radio group) with arrow-key selection. */
export function ChoiceTiles<T extends string>({ id, value, options, onValueChange, disabled = false, className, ...aria }: ChoiceTilesProps<T>) {
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const descriptionId = React.useId();
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
    <div id={id} role="radiogroup" aria-disabled={disabled || undefined} className={cn("grid gap-4 sm:grid-cols-2", className)} {...aria}>
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
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
            aria-describedby={option.description ? `${descriptionId}-${index}` : undefined}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "group flex h-full w-full flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "border-primary bg-primary/5" : "border-border enabled:hover:border-foreground/20 enabled:hover:bg-accent/40",
            )}
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted", option.iconBackgroundClassName)}>
                <Icon className={cn("size-5 text-muted-foreground", option.iconClassName)} aria-hidden="true" />
              </span>
              <span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                {selected ? <Check className="size-3" /> : null}
              </span>
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{option.label}</span>
              {option.description ? <span id={`${descriptionId}-${index}`} className="block text-xs leading-relaxed text-muted-foreground">{option.description}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
