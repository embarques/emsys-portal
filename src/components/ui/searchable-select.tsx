"use client";

import * as React from "react";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusNextFormField } from "@/hooks/use-form-enter-navigation";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  /** When true, focuses select all visible text so it can be replaced immediately. */
  selectAllOnFocus?: boolean;
  /** Opens options in a bottom sheet on phones. Desktop keeps the normal popover. */
  mobileSheet?: boolean;
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

/** Empty-value options like "Select invoice" are list placeholders, not real selections. */
function isPseudoPlaceholderOption(option: SearchableSelectOption): boolean {
  if (option.value !== "") return false;
  const label = option.label.trim();
  if (!label) return true;
  return /^select\b/i.test(label);
}

function hasSearchableSelectSelection(
  value: string,
  selectedOption: SearchableSelectOption | undefined,
): boolean {
  if (!selectedOption) return false;
  if (selectedOption.value !== "") return true;
  return !isPseudoPlaceholderOption(selectedOption);
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

const MOBILE_SHEET_SEARCH_THRESHOLD = 8;

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
  selectAllOnFocus = false,
  mobileSheet = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const suppressNextFocusSearchRef = React.useRef(false);
  const scrollIsolationRef = useScrollIsolation();
  const isMobile = useIsMobileViewport();
  const [viewportResolved, setViewportResolved] = React.useState(false);

  React.useEffect(() => {
    setViewportResolved(true);
  }, []);

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) {
      setQuery("");
      onClose?.();
    }
  }

  const selectedOption = options.find((option) => option.value === value);
  const hasSelection = hasSearchableSelectSelection(value, selectedOption);

  function focusSearchInput(shouldSelectAll = false) {
    if (disabled) return;
    if (suppressNextFocusSearchRef.current) {
      suppressNextFocusSearchRef.current = false;
      return;
    }
    if (shouldSelectAll && hasSelection && selectedOption && !open) {
      changeQuery(selectedOption.label);
    }
    setOpen(true);
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      if (shouldSelectAll && input?.value.trim()) {
        input.select();
      }
    });
  }

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
    !truncateSelection && !open && hasSelection && !query;
  const canClearSelection = hasSelection && value !== "";

  function clearSelection() {
    suppressNextFocusSearchRef.current = true;
    onValueChange("");
    changeQuery("");
    setOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function renderOptionItems(selectOptions: SearchableSelectOption[]) {
    return selectOptions.map((option, index) => {
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
  }

  const selectableOptions = options.filter((option) => !isPseudoPlaceholderOption(option));
  const optionItems = renderOptionItems(selectableOptions);

  if (mobileSheet && (isMobile || !viewportResolved)) {
    const sheetTitle = ariaLabel ?? placeholder;
    const mobileOptions = selectableOptions;
    const showMobileSearch = searchable && mobileOptions.length > MOBILE_SHEET_SEARCH_THRESHOLD;

    return (
      <div className="relative">
        <Sheet open={open} onOpenChange={handleOpenChange}>
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
            onClick={() => handleOpenChange(true)}
            className={cn(
              triggerClassName,
              "disabled:cursor-not-allowed disabled:opacity-50",
              className,
              "pr-9 pl-3",
            )}
          >
            <span className={cn(selectionClassName, !hasSelection && "text-muted-foreground")}>
              {hasSelection && selectedOption ? selectedOption.label : placeholder}
            </span>
            <span className={cn(chevronButtonClassName, disabled && "pointer-events-none opacity-50")}>
              <ChevronDown className="size-4" aria-hidden />
            </span>
          </button>

          <SheetContent
            side="bottom"
            className="z-[90] flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="shrink-0 border-b px-4 py-4 pr-14">
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <Command
              className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
              shouldFilter={searchable && !manualFiltering}
              filter={accentInsensitiveFilter}
            >
              {showMobileSearch ? (
                <div className="shrink-0 border-b px-4 py-3">
                  <CommandPrimitive.Input
                    ref={inputRef}
                    disabled={disabled}
                    value={query}
                    onValueChange={changeQuery}
                    placeholder={searchPlaceholder ?? placeholder}
                    className="h-11 w-full rounded-lg border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />
                </div>
              ) : null}
              <CommandList ref={scrollIsolationRef} className="max-h-none flex-1 overflow-y-auto p-0">
                <CommandEmpty className="px-4 py-4 text-sm">
                  {loading ? loadingMessage : emptyMessage}
                </CommandEmpty>
                {renderOptionItems(mobileOptions)}
              </CommandList>
            </Command>
          </SheetContent>
        </Sheet>
        {requiredField}
      </div>
    );
  }

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
              <span className={cn(selectionClassName, !hasSelection && "text-muted-foreground")}>
                {hasSelection && selectedOption ? selectedOption.label : placeholder}
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
                focusSearchInput(selectAllOnFocus && hasSelection);
              }}
              className={cn(
                triggerClassName,
                disabled && "cursor-not-allowed opacity-50",
                className,
                canClearSelection ? "pr-16 pl-3" : "pr-9 pl-3",
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
                value={open ? query : hasSelection ? query || selectedOption?.label || "" : query}
                onValueChange={(next) => {
                  changeQuery(next);
                  if (!open) setOpen(true);
                }}
                onFocus={() => focusSearchInput(selectAllOnFocus)}
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
                    : hasSelection
                      ? undefined
                      : placeholder
                }
                readOnly={!open && hasSelection}
                className={cn(
                  showSelectionLabel && "sr-only",
                  truncateSelection
                    ? "min-w-0 flex-1 truncate bg-transparent text-left outline-none disabled:cursor-not-allowed"
                    : "whitespace-nowrap bg-transparent text-left outline-none disabled:cursor-not-allowed",
                  "placeholder:text-muted-foreground",
                  !hasSelection && !open && "text-muted-foreground",
                )}
              />
              {canClearSelection ? (
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  aria-label="Clear selection"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    clearSelection();
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  className="absolute inset-y-0 right-8 flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
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
