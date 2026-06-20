"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  /** Extra muted lines rendered below the label, each on its own row. */
  descriptionLines?: string[];
  keywords?: string[];
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  autoFocus?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const popoverContentClassName =
  // pointer-events-auto keeps the list interactive when opened inside a Radix modal (Dialog),
  // which disables pointer events on the body and would otherwise block hover/scroll/click.
  "pointer-events-auto w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden border-muted-foreground/25 p-0 shadow-lg";

/**
 * Keep wheel/touch scrolling working when the list is portaled out of a Radix modal (Dialog).
 * The Dialog's scroll-lock cancels scroll events that bubble up to `document` from outside its
 * subtree; stopping propagation on the list itself lets the native overflow scroll happen.
 */
function useScrollIsolation() {
  return React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener("wheel", stop, { passive: true });
    node.addEventListener("touchmove", stop, { passive: true });
  }, []);
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled = false,
  searchable = true,
  required = false,
  id,
  name,
  className,
  contentClassName,
  align = "start",
  autoFocus = false,
  defaultOpen = false,
  onClose,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const scrollIsolationRef = useScrollIsolation();

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) {
      setQuery("");
      onClose?.();
    }
  }

  const selectedOption = options.find((option) => option.value === value);

  const requiredField = required ? (
    <input
      aria-hidden
      tabIndex={-1}
      required
      name={name}
      value={value}
      onChange={() => {}}
      className="pointer-events-none absolute inset-0 size-full opacity-0"
    />
  ) : name ? (
    <input type="hidden" name={name} value={value} />
  ) : null;

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  const optionItems = options.map((option) => {
    const detailLines = [option.description, ...(option.descriptionLines ?? [])].filter(
      (line): line is string => Boolean(line && line.trim()),
    );

    return (
      <CommandItem
        key={option.value}
        value={option.value}
        keywords={[option.label, ...(option.keywords ?? [])]}
        disabled={option.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onSelect={() => handleSelect(option.value)}
        className={cn(detailLines.length > 0 && "items-start")}
      >
        <Check
          className={cn(
            "size-4 shrink-0",
            detailLines.length > 0 && "mt-0.5",
            option.value === value ? "opacity-100" : "opacity-0",
          )}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{option.label}</span>
          {detailLines.map((line, lineIndex) => (
            <span key={lineIndex} className="truncate text-xs text-muted-foreground">
              {line}
            </span>
          ))}
        </span>
      </CommandItem>
    );
  });

  // Plain select: trigger is a button, no inline typing.
  if (!searchable) {
    return (
      <div className="relative">
        <Popover open={open} onOpenChange={handleOpenChange} modal>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              autoFocus={autoFocus}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
              )}
            >
              <span className={cn("truncate text-left", !selectedOption && "text-muted-foreground")}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align={align} className={cn(popoverContentClassName, contentClassName)}>
            <Command>
              <CommandList ref={scrollIsolationRef}>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                {optionItems}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {requiredField}
      </div>
    );
  }

  // Searchable: the trigger itself is a text field; options filter as you type.
  return (
    <div className="relative">
      <Command className="overflow-visible bg-transparent">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (disabled) return;
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverAnchor asChild>
            <div
              onClick={() => {
                if (disabled) return;
                setOpen(true);
                inputRef.current?.focus();
              }}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors",
                "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                disabled && "cursor-not-allowed opacity-50",
                className
              )}
            >
              <CommandPrimitive.Input
                ref={inputRef}
                id={id}
                disabled={disabled}
                value={query}
                onValueChange={(next) => {
                  setQuery(next);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                    inputRef.current?.blur();
                  }
                }}
                role="combobox"
                aria-expanded={open}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                placeholder={open ? searchPlaceholder : selectedOption ? selectedOption.label : placeholder}
                className={cn(
                  "flex-1 truncate bg-transparent text-left outline-none disabled:cursor-not-allowed",
                  !open && selectedOption ? "placeholder:text-foreground" : "placeholder:text-muted-foreground"
                )}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align={align}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(popoverContentClassName, contentClassName)}
          >
            <CommandList ref={scrollIsolationRef}>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {optionItems}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
      {requiredField}
    </div>
  );
}
