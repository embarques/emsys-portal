"use client";

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useAddressAutocomplete } from "@/hooks/use-address-autocomplete";
import { useTranslation } from "@/lib/i18n";
import type { PlaceSuggestion } from "@/lib/maps/places";
import type { ParsedPlaceAddress } from "@/lib/customers/types";
import { cn } from "@/lib/utils";

type AddressAutocompleteInputProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onPlaceSelected: (place: ParsedPlaceAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowManualEntry?: boolean;
  onManualEntryChange?: (manual: boolean) => void;
  manualEntryTogglePosition?: "below" | "label" | "none";
  manualEntry?: boolean;
};

export function AddressAutocompleteInput({
  id,
  value,
  onValueChange,
  onPlaceSelected,
  placeholder,
  disabled,
  className,
  allowManualEntry = false,
  onManualEntryChange,
  manualEntryTogglePosition = "below",
  manualEntry: manualEntryOverride,
}: AddressAutocompleteInputProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-suggestions`;
  const { enabled, suggestions, isLoading, setQuery, resolveSuggestion } = useAddressAutocomplete();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const [internalManualEntry, setInternalManualEntry] = useState(false);
  const manualEntry = manualEntryOverride ?? internalManualEntry;
  const containerRef = useRef<HTMLDivElement>(null);
  // Suppress reopening the dropdown from the value change triggered by a selection.
  const skipNextQueryRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  function handleChange(next: string) {
    onValueChange(next);
    if (!enabled) return;
    if (skipNextQueryRef.current) {
      skipNextQueryRef.current = false;
      return;
    }
    setQuery(next);
    setOpen(true);
  }

  async function handleSelect(suggestion: PlaceSuggestion) {
    skipNextQueryRef.current = true;
    const street = suggestion.primaryText || suggestion.description;
    setOpen(false);
    setQuery("");
    setResolving(true);
    try {
      const parsed = await resolveSuggestion(suggestion);
      if (parsed) {
        // Apply street + city/state/zip in one place-selected update so the
        // separate apartment field is not wiped by an intermediate address1-only
        // change (browser autofill can clear adjacent unit fields).
        onPlaceSelected({ ...parsed, address1: parsed.address1 || street });
      } else {
        onValueChange(street);
      }
    } finally {
      setResolving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void handleSelect(suggestions[activeIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = enabled && open && (suggestions.length > 0 || isLoading);

  const showAutocomplete = enabled && !manualEntry;

  return (
    <div ref={containerRef} className={cn(manualEntryTogglePosition === "label" ? "relative" : "space-y-1")}>
      <div className="relative">
        {showAutocomplete ? (
          <Input
            id={id}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onFocus={() => {
              if (enabled && suggestions.length > 0) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className={cn(resolving && "pr-9", className)}
          />
        ) : (
          <Input
            id={id}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="street-address"
            className={className}
          />
        )}
      {resolving ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}

      {showAutocomplete && showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          {isLoading && suggestions.length === 0 ? (
            <li className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching addresses…
            </li>
          ) : null}
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleSelect(suggestion)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors",
                  index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{suggestion.primaryText}</span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.secondaryText}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      </div>
      {allowManualEntry && enabled && manualEntryTogglePosition !== "none" ? (
        <button
          type="button"
          className={cn(
            "text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
            manualEntryTogglePosition === "label" && "absolute -top-6 right-0",
          )}
          onClick={() => {
            const nextManualEntry = !manualEntry;
            if (manualEntryOverride === undefined) setInternalManualEntry(nextManualEntry);
            onManualEntryChange?.(nextManualEntry);
            setOpen(false);
            setQuery("");
          }}
        >
          {manualEntry ? t("common.address.useGoogle") : t("common.address.useManual")}
        </button>
      ) : null}
    </div>
  );
}
