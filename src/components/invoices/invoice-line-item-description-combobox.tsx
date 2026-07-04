"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import type { Item } from "@/lib/items/types";
import { cn } from "@/lib/utils";

type InvoiceLineItemDescriptionComboboxProps = {
  id?: string;
  value: string;
  catalogItems: Item[];
  onValueChange: (value: string) => void;
  onCatalogItemSelect: (item: Item) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  onAutoFocusComplete?: () => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
};

export function InvoiceLineItemDescriptionCombobox({
  id,
  value,
  catalogItems,
  onValueChange,
  onCatalogItemSelect,
  placeholder = "Type or search catalog items…",
  required,
  className,
  autoFocus = false,
  onAutoFocusComplete,
  onFocus,
}: InvoiceLineItemDescriptionComboboxProps) {
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-catalog-suggestions`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipQuerySyncRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (skipQuerySyncRef.current) {
      skipQuerySyncRef.current = false;
      return;
    }
    setQuery(value);
  }, [value]);

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

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? catalogItems.filter((item) => item.description.toLowerCase().includes(normalized))
      : catalogItems;

    return matches.slice(0, 40);
  }, [catalogItems, query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    if (!autoFocus) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: false });
      inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      onAutoFocusComplete?.();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, onAutoFocusComplete]);

  function handleInputChange(next: string) {
    setQuery(next);
    onValueChange(next);
    setOpen(true);
  }

  function handleSelect(item: Item) {
    skipQuerySyncRef.current = true;
    setQuery(item.description);
    onCatalogItemSelect(item);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]!);
    }
  }

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={query}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={(event) => {
          setOpen(true);
          onFocus?.(event);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-autocomplete="list"
        className={className}
      />

      {showSuggestions ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-[80] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {suggestions.map((item, index) => (
            <li key={item.itemId} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/60",
                  index === activeIndex && "bg-muted/60",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                <span className="min-w-0 flex-1">{item.description}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatInvoiceMoney(item.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
