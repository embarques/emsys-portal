"use client";

import * as React from "react";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import { ChevronDown, ChevronUp, LoaderCircle, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusNextFormField, isAutomaticSelectionFocus } from "@/hooks/use-form-enter-navigation";
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
  /** Size the trigger to the longest option label so every choice fits without truncating. */
  fitToOptions?: boolean;
  align?: "start" | "center" | "end";
  autoFocus?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  /** When true, focuses select all visible text so it can be replaced immediately. */
  selectAllOnFocus?: boolean;
  /**
   * After selecting an option, move focus to the next form field (default).
   * Set false when the parent handles post-select focus (e.g. skip an auto-filled field).
   */
  advanceFocusOnSelect?: boolean;
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

function labelsMatch(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

/**
 * Empty-value options that duplicate the closed-state placeholder, or look like
 * "Select…" / "Seleccionar…" prompts, belong on the trigger, not in the open list.
 */
function isPseudoPlaceholderOption(
  option: SearchableSelectOption,
  placeholder?: string,
): boolean {
  if (option.value !== "") return false;
  const label = option.label.trim();
  if (!label || option.disabled) return true;
  const placeholderLabel = placeholder?.trim();
  if (placeholderLabel && labelsMatch(label, placeholderLabel)) return true;
  return /^(select|seleccionar|seleccione)\b/i.test(label);
}

function hasSearchableSelectSelection(
  value: string,
  selectedOption: SearchableSelectOption | undefined,
  placeholder?: string,
): boolean {
  if (!selectedOption) return false;
  if (selectedOption.value !== "") return true;
  return !isPseudoPlaceholderOption(selectedOption, placeholder);
}

function optionMatchesQuery(option: SearchableSelectOption, query: string): boolean {
  if (!query.trim()) return true;
  return (
    accentInsensitiveFilter(option.value, query, [option.label, ...(option.keywords ?? [])]) > 0
  );
}

function getNavigableOptions(
  options: SearchableSelectOption[],
  query: string,
  shouldClientFilter: boolean,
  placeholder?: string,
): SearchableSelectOption[] {
  return options.filter((option) => {
    if (isPseudoPlaceholderOption(option, placeholder) || option.disabled) return false;
    if (!shouldClientFilter) return true;
    return optionMatchesQuery(option, query);
  });
}

function moveHighlight(
  options: SearchableSelectOption[],
  current: string,
  direction: 1 | -1,
): string {
  if (options.length === 0) return current;
  const index = options.findIndex((option) => option.value === current);
  if (index === -1) {
    return options[direction === 1 ? 0 : options.length - 1]!.value;
  }
  return options[(index + direction + options.length) % options.length]!.value;
}

const triggerClassName =
  "relative flex min-h-10 w-full min-w-0 max-w-full items-center rounded-lg border-2 border-foreground/60 bg-card py-2 pl-3 pr-9 text-sm outline-none transition-[border-color,box-shadow] focus-within:border-foreground data-[state=open]:border-foreground max-md:min-h-12 max-md:rounded-xl max-md:border-input max-md:text-base max-md:shadow-xs max-md:focus-within:border-ring max-md:focus-within:ring-[3px] max-md:focus-within:ring-ring/50 max-md:data-[state=open]:border-ring max-md:data-[state=open]:ring-[3px] max-md:data-[state=open]:ring-ring/50";

const chevronButtonClassName =
  "absolute inset-y-0 right-0 flex w-9 shrink-0 items-center justify-center text-foreground/70 disabled:cursor-not-allowed";

const popoverContentClassName =
  // pointer-events-auto keeps the list interactive when opened inside a Radix Dialog,
  // which disables pointer events on the body and would otherwise block hover/scroll/click.
  // z-[80] stacks above DialogContent (often z-[50]/z-[70]) so options are not hidden behind the modal.
  // Do not use Popover `modal` here: a modal popover nested in a Dialog applies its own
  // pointer-events lock on the dialog surface and freezes fields/buttons underneath.
  "pointer-events-auto z-[80] w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-md";

const listItemClassName =
  "cursor-pointer rounded-none px-4 py-3 text-sm data-[selected=true]:bg-muted/60 data-[selected=true]:text-foreground";

const MOBILE_SHEET_SEARCH_THRESHOLD = 8;

function MobileSelectLoading({ message }: { message: string }) {
  return (
    <div
      className="relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.06] via-background to-background px-4 py-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="flex flex-col items-center">
        <div className="relative mb-3 grid size-14 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <LoaderCircle
            className="absolute inset-0 size-14 animate-spin text-primary drop-shadow-sm"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="relative grid size-10 place-items-center rounded-full border border-primary/25 bg-card shadow-lg shadow-primary/10">
            <Search className="size-5 text-primary" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border bg-card/80 shadow-sm" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-b px-4 py-3 last:border-b-0">
            <div className="space-y-2">
              <div className="h-3.5 w-40 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">{message}</span>
    </div>
  );
}

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
  fitToOptions = false,
  align = "start",
  autoFocus = false,
  defaultOpen = false,
  onClose,
  selectAllOnFocus = false,
  advanceFocusOnSelect = true,
  mobileSheet = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const suppressNextFocusSearchRef = React.useRef(false);
  const skipOpenOnFocusRef = React.useRef(false);
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
  const hasSelection = hasSearchableSelectSelection(value, selectedOption, placeholder);
  const fitToOptionsLabel = React.useMemo(() => {
    if (!fitToOptions) return "";
    return [placeholder, ...options.map((option) => option.label)].reduce(
      (longest, label) => (label.length > longest.length ? label : longest),
      "",
    );
  }, [fitToOptions, options, placeholder]);

  function focusSearchInput(shouldSelectAll = false) {
    if (disabled || skipOpenOnFocusRef.current) return;
    // Deposit/Zelle mount a bank selector during selection. Focus it without
    // opening another Popper while the first popup and form are still settling.
    if (isAutomaticSelectionFocus(inputRef.current ?? triggerRef.current)) return;
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
    setOpen(false);
    changeQuery("");
    onValueChange(nextValue);

    if (!advanceFocusOnSelect) return;

    const focusTarget = searchable ? inputRef.current : triggerRef.current;
    skipOpenOnFocusRef.current = true;
    window.setTimeout(() => {
      try {
        if (!focusNextFormField(focusTarget, { suppressComboboxOpen: true })) {
          focusTarget?.focus();
        }
      } finally {
        skipOpenOnFocusRef.current = false;
      }
    }, 0);
  }

  const shouldClientFilter = searchable && !manualFiltering;
  const navigableOptions = React.useMemo(
    () => getNavigableOptions(options, query, shouldClientFilter, placeholder),
    [options, query, shouldClientFilter, placeholder],
  );
  const [highlight, setHighlight] = React.useState("");
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    setHighlight((current) => {
      if (!justOpened && current && navigableOptions.some((option) => option.value === current)) {
        return current;
      }
      const selected = navigableOptions.find((option) => option.value === value);
      return selected?.value ?? navigableOptions[0]?.value ?? "";
    });
  }, [open, navigableOptions, value]);

  React.useEffect(() => {
    if (!open || !searchable) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, searchable]);

  function handleComboboxKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      changeQuery("");
      if (searchable) {
        inputRef.current?.blur();
      } else {
        triggerRef.current?.focus();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => moveHighlight(navigableOptions, current, direction));
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) return;
    if (!open) return;
    event.preventDefault();
    event.stopPropagation();
    const selected =
      navigableOptions.find((option) => option.value === highlight) ?? navigableOptions[0];
    if (selected) handleSelect(selected.value);
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

  function renderOptionItems(selectOptions: SearchableSelectOption[], isMobileSheet = false) {
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
          onMouseMove={() => {
            if (!option.disabled) setHighlight(option.value);
          }}
          onSelect={() => handleSelect(option.value)}
          className={cn(
            listItemClassName,
            detailLines.length > 0 && "items-start",
            isMobileSheet &&
              "min-h-14 rounded-none border-b border-border/60 px-4 py-4 text-base last:border-b-0 data-[selected=true]:bg-primary/5",
          )}
        >
          <span className="flex min-w-0 flex-col">
            <span className={fitToOptions ? "whitespace-nowrap" : "truncate"}>{option.label}</span>
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

  const selectableOptions = options.filter(
    (option) => !isPseudoPlaceholderOption(option, placeholder),
  );
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
            className="z-[90] flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] max-md:bottom-[env(safe-area-inset-bottom)] max-md:top-[calc(env(safe-area-inset-top)+0.75rem)] max-md:max-h-none max-md:rounded-2xl max-md:border"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="shrink-0 border-b px-4 py-4 pr-14">
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <Command
              className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
              shouldFilter={searchable && !manualFiltering}
              filter={accentInsensitiveFilter}
              value={highlight}
              onValueChange={(next) => {
                setHighlight((current) => (current === next ? current : next));
              }}
              loop
            >
              {showMobileSearch ? (
                <div className="shrink-0 border-b px-4 py-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <CommandPrimitive.Input
                      ref={inputRef}
                      disabled={disabled}
                      value={query}
                      onValueChange={changeQuery}
                      onKeyDown={handleComboboxKeyDown}
                      placeholder={searchPlaceholder}
                      className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                  </div>
                </div>
              ) : null}
              <CommandList ref={scrollIsolationRef} className="max-h-none flex-1 overflow-y-auto p-0">
                {loading ? (
                  <MobileSelectLoading message={loadingMessage} />
                ) : (
                  <>
                    <CommandEmpty className="px-4 py-4 text-sm">
                      {emptyMessage}
                    </CommandEmpty>
                    {renderOptionItems(mobileOptions, true)}
                  </>
                )}
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
        <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
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
              onKeyDown={handleComboboxKeyDown}
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
            onKeyDown={handleComboboxKeyDown}
            className={cn(popoverContentClassName, contentClassName)}
          >
            <Command
              value={highlight}
              onValueChange={(next) => {
                setHighlight((current) => (current === next ? current : next));
              }}
              loop
            >
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
    <div className={cn("relative", fitToOptions && "inline-flex max-w-full shrink-0")}>
      {fitToOptions ? (
        <span
          aria-hidden
          className="invisible inline-flex h-10 items-center whitespace-nowrap pl-3 pr-16 text-sm max-md:min-h-12 max-md:text-base"
        >
          {fitToOptionsLabel}
        </span>
      ) : null}
      <Command
        className={cn("overflow-visible bg-transparent", fitToOptions && "absolute inset-0")}
        shouldFilter={!manualFiltering}
        filter={accentInsensitiveFilter}
        value={highlight}
        onValueChange={(next) => {
          setHighlight((current) => (current === next ? current : next));
        }}
        loop
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
          modal={false}
        >
          <PopoverAnchor asChild>
            <div
              ref={anchorRef}
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
                onKeyDown={handleComboboxKeyDown}
                role="combobox"
                aria-expanded={open}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                placeholder={
                  open
                    ? searchPlaceholder
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
            onPointerDownOutside={(event) => {
              if (anchorRef.current?.contains(event.target as Node)) {
                event.preventDefault();
              }
            }}
            onFocusOutside={(event) => {
              if (anchorRef.current?.contains(event.target as Node)) {
                event.preventDefault();
              }
            }}
            onKeyDown={handleComboboxKeyDown}
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
