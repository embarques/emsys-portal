"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import type { SearchableSelectProps } from "@/components/ui/searchable-select";
import { focusNextFormField, isImeComposing } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The same single selection as a dropdown, exposed as a wrapping radio-button group. */
export function SelectOptionButtons(props: SearchableSelectProps & {
  /** Set false when a choice is always required, so no "Clear selection" control is offered. */
  clearable?: boolean;
}) {
  const { options, value, onValueChange, disabled, id, name, autoFocus, required, advanceFocusOnSelect = true, clearable = true } = props;
  const { t } = useTranslation();
  const descriptionId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.flatMap((option, index) => !disabled && !option.disabled ? [index] : []);
  const selected = options.findIndex((option) => option.value === value);
  const focusIndex = enabled.includes(selected) ? selected : enabled[0] ?? 0;

  useEffect(() => {
    if (autoFocus) buttons.current[focusIndex]?.focus();
    // Match dropdown autofocus on mount; changing the selection must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(index: number, advance: boolean) {
    const option = options[index];
    if (disabled || option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    if (advance && advanceFocusOnSelect) window.setTimeout(() => {
      const button = buttons.current[index];
      if (button?.isConnected && button.getClientRects().length) focusNextFormField(button, { suppressComboboxOpen: true });
    }, 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (isImeComposing(event)) return;
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    if (enabled.length && (direction || event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled[enabled.length - 1] : enabled[(enabled.indexOf(index) + direction + enabled.length) % enabled.length];
      buttons.current[next]?.focus();
      select(next, false);
    } else if (event.key === "Enter" && options[index].value !== value) {
      event.preventDefault();
      event.stopPropagation();
      select(index, true);
    }
  }

  return (
    <div className={cn("relative min-w-0", props.className)} data-enter-navigation="field">
      {required ? <input name={name} required value={value} disabled={disabled} onChange={() => {}}
        aria-hidden tabIndex={-1} className="pointer-events-none absolute size-px opacity-0"
        onInvalid={(event) => { event.preventDefault(); buttons.current[focusIndex]?.focus(); }} />
        : name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
      <div role="radiogroup" aria-label={props["aria-label"] ?? props.placeholder} aria-labelledby={props["aria-labelledby"]}
        aria-required={required || undefined} aria-invalid={props["aria-invalid"]} aria-disabled={disabled || undefined}
        className="flex flex-wrap items-stretch gap-2">
        {options.map((option, index) => {
          const checked = option.value === value;
          const descriptions = [option.description, ...(option.descriptionLines ?? [])].filter(Boolean);
          return <button key={option.value} ref={(node) => { buttons.current[index] = node; }}
            id={index === focusIndex ? id : id ? `${id}-option-${index}` : undefined}
            type="button" role="radio" aria-checked={checked} aria-invalid={props["aria-invalid"]}
            aria-describedby={descriptions.length ? `${descriptionId}-${index}` : undefined}
            tabIndex={index === focusIndex ? 0 : -1} disabled={disabled || option.disabled}
            onClick={() => select(index, true)} onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn("flex min-h-12 min-w-0 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              checked ? "border-primary bg-primary/10 text-primary" : "border-input bg-card hover:bg-accent",
              props["aria-invalid"] && "border-destructive")}>
            <span aria-hidden="true" className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}>
              {checked ? <Check className="size-3" /> : null}
            </span>
            <span className="min-w-0 break-words">
              <span className="block font-medium">{option.label}</span>
              {descriptions.length ? <span id={`${descriptionId}-${index}`} className="mt-0.5 block text-xs text-muted-foreground">{descriptions.map((line, lineIndex) => <span key={lineIndex} className="block">{line}</span>)}</span> : null}
            </span>
          </button>;
        })}
      </div>
      {clearable && value !== "" && !options.some((option) => option.value === "") ? <button type="button" disabled={disabled}
        aria-label={t("common.ui.clearSelection")} title={t("common.ui.clearSelection")}
        onClick={() => { onValueChange(""); buttons.current[enabled[0] ?? 0]?.focus(); }}
        className="mt-1 flex min-h-9 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <X aria-hidden="true" className="size-3" />{t("common.ui.clearSelection")}
      </button> : null}
    </div>
  );
}
