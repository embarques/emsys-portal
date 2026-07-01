"use client";

import * as React from "react";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusNextFormField } from "@/hooks/use-form-enter-navigation";
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
  /** Notifies the parent of the live search query (for server-side/remote search). */
  onSearchChange?: (query: string) => void;
  /** Disables the built-in client-side filtering so server-provided options render as-is. */
  manualFiltering?: boolean;
  /** Shows a loading message instead of the empty message while remote results are fetching. */
  loading?: boolean;
  loadingMessage?: string;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  contentClassName?: string;
  /** When false, the closed trigger grows to show the full selected label instead of truncating. */
  truncateSelection?: boolean;
  align?: "start" | "center" | "end";
  autoFocus?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** Strip diacritics so "e" matches "é"/"è" and vice versa during search. */
function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Accent-insensitive wrapper around cmdk's default fuzzy filter: both the option
 * text/keywords and the typed query are normalized, so "barahona" matches
 * "Barahona" and "penon" matches "Peñón" while keeping cmdk's ranking.
 */
function accentInsensitiveFilter(value: string, search: string, keywords?: string[]): number {
  return defaultFilter(
    stripDiacritics(value),
    stripDiacritics(search),
    keywords?.map(stripDiacritics),
  );
}

const triggerClassName =
  "relative flex min-h-10 w-full items-center rounded-lg border-2 border-foreground/60 bg-card py-2 pl-3 pr-9 text-sm outline-none transition-[border-color,box-shadow] focus-within:border-foreground data-[state=open]:border-foreground";

const chevronButtonClassName =
  "absolute inset-y-0 right-0 flex w-9 shrink-0 items-center justify-center text-foreground/70 disabled:cursor-not-allowed";

const popoverContentClassName =
  // pointer-events-auto keeps the list interactive when opened inside a Radix modal (Dialog),
  // which disables pointer events on the body and would otherwise block hover/scroll/click.
  // z-[80] stacks above DialogContent (often z-[60]/z-[70]) so options are not hidden behind the modal.
  "pointer-events-auto z-[80] w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-md";

const listItemClassName =
  "cursor-pointer rounded-none px-4 py-3 text-sm data-[selected=true]:bg-muted/60 data-[selected=true]:text-foreground";

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
  searchPlaceholder,
  emptyMessage = "No results found.",
  onSearchChange,
  manualFiltering = false,
  loading = false,
  loadingMessage = "Searching…",
  disabled = false,
  searchable = true,
  required = false,
  id,
  name,
  className,
  contentClassName,
  truncateSelection = true,
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
  const triggerRef = React.useRef<HTMLButtonElement>(null);
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

  function changeQuery(next: string) {
    setQuery(next);
    onSearchChange?.(next);
  }

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    changeQuery("");
    setOpen(false);

    const focusTarget = searchable ? inputRef.current : triggerRef.current;
    window.setTimeout(() => {
      if (!focusNextFormField(focusTarget)) {
        focusTarget?.focus();
      }
    }, 0);
  }

  function toggleOpen() {
    if (disabled) return;
    handleOpenChange(!open);
    if (!open) {
      inputRef.current?.focus();
    }
  }

  const ChevronIcon = open ? ChevronUp : ChevronDown;

  const selectionClassName = truncateSelection
    ? "min-w-0 flex-1 truncate text-left"
    : "whitespace-nowrap text-left";
  const showSelectionLabel =
    !truncateSelection && !open && Boolean(selectedOption) && !query;

  const optionItems = options.map((option, index) => {
    const detailLines = [option.description, ...(option.descriptionLines ?? [])].filter(
      (line): line is string => Boolean(line && line.trim()),
    );

    return (
      <CommandItem
        key={`${option.value}-${index}`}
        value={option.value}
        keywords={[option.label, ...(option.keywords ?? [])]}
        disabled={option.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onSelect={() => handleSelect(option.value)}
        className={cn(listItemClassName, detailLines.length > 0 && "items-start")}
      >
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
              ref={triggerRef}
              type="button"
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              autoFocus={autoFocus}
              disabled={disabled}
              data-state={open ? "open" : "closed"}
              className={cn(
                triggerClassName,
                "disabled:cursor-not-allowed disabled:opacity-50",
                className,
                "pr-9 pl-3",
              )}
            >
              <span className={cn(selectionClassName, !selectedOption && "text-muted-foreground")}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <span className={cn(chevronButtonClassName, disabled && "pointer-events-none opacity-50")}>
                <ChevronIcon className="size-4" aria-hidden />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align={align}
            sideOffset={4}
            className={cn(popoverContentClassName, contentClassName)}
          >
            <Command>
              <CommandList ref={scrollIsolationRef} className="max-h-60 p-0">
                <CommandEmpty className="px-4 py-3 text-sm">{emptyMessage}</CommandEmpty>
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
      <Command
        className="overflow-visible bg-transparent"
        shouldFilter={!manualFiltering}
        filter={accentInsensitiveFilter}
      >
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (disabled) return;
            setOpen(next);
            if (!next) {
              changeQuery("");
              onClose?.();
            }
          }}
          modal
        >
          <PopoverAnchor asChild>
            <div
              data-state={open ? "open" : "closed"}
              onClick={() => {
                if (disabled) return;
                setOpen(true);
                inputRef.current?.focus();
              }}
              className={cn(
                triggerClassName,
                disabled && "cursor-not-allowed opacity-50",
                className,
                "pr-9 pl-3",
              )}
            >
              {showSelectionLabel ? (
                <span aria-hidden className="whitespace-nowrap text-left">
                  {selectedOption?.label}
                </span>
              ) : null}
              <CommandPrimitive.Input
                ref={inputRef}
                id={id}
                disabled={disabled}
                value={open ? query : query || selectedOption?.label || ""}
                onValueChange={(next) => {
                  changeQuery(next);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    changeQuery("");
                    inputRef.current?.blur();
                  }
                }}
                role="combobox"
                aria-expanded={open}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                placeholder={
                  open
                    ? (searchPlaceholder ?? placeholder)
                    : selectedOption
                      ? undefined
                      : placeholder
                }
                readOnly={!open && Boolean(selectedOption)}
                className={cn(
                  showSelectionLabel && "sr-only",
                  truncateSelection
                    ? "min-w-0 flex-1 truncate bg-transparent text-left outline-none disabled:cursor-not-allowed"
                    : "whitespace-nowrap bg-transparent text-left outline-none disabled:cursor-not-allowed",
                  "placeholder:text-muted-foreground",
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                aria-label={open ? "Close options" : "Open options"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleOpen();
                }}
                className={chevronButtonClassName}
              >
                <ChevronIcon className="size-4" aria-hidden />
              </button>
            </div>
          </PopoverAnchor>
          <PopoverContent
            align={align}
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(popoverContentClassName, contentClassName)}
          >
            <CommandList ref={scrollIsolationRef} className="max-h-60 p-0">
              <CommandEmpty className="px-4 py-3 text-sm">
                {loading ? loadingMessage : emptyMessage}
              </CommandEmpty>
              {optionItems}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
      {requiredField}
    </div>
  );
}
