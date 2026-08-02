"use client";

import { ChevronDown, ChevronRight, ChevronUp, Loader2, LoaderCircle, Search, UsersRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import {
  useCustomer,
  useCustomerAutocomplete,
  useCustomerDetailsBatch,
  useCustomerPicker,
  useEnsureCustomerDetail,
} from "@/lib/customers/hooks/use-customers";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import type { Customer, CustomerSearchResult } from "@/lib/customers/types";
import {
  resolveCustomerAddressCount,
  formatAddress,
  ADDRESS_TEXT_WRAP_CLASSNAME,
  getAddressKey,
  getAddressLabelKey,
  getMatchedAddress,
  getPrimaryAddress,
  orderAddressesForDisplay,
} from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { cn } from "@/lib/utils";

export type CustomerPartySelectProps = {
  id?: string;
  partyType: "sender" | "receiver";
  value: string;
  selectedCustomer?: Customer | null;
  onValueChange: (customerId: string, customer: Customer, addressId?: string) => void;
  placeholder?: string;
  pickerTitle?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Show the Primary/Other label badge next to each expanded address. */
  showAddressLabels?: boolean;
};

type CollapsedAddressPreview = {
  visibleLine: string;
  primaryLine?: string;
  showMatchedBadge: boolean;
};

function toSearchResults(customers: Customer[]): CustomerSearchResult[] {
  return customers.map((customer) => ({ customer }));
}

function buildCollapsedPreview(result: CustomerSearchResult): CollapsedAddressPreview {
  const { customer, matchedAddressId, matchedBy } = result;
  const matched = getMatchedAddress(customer, matchedAddressId);
  const primary = getPrimaryAddress(customer);

  if (matched) {
    const matchedLine = formatAddress(matched, "full");
    const primaryLine =
      primary && getAddressKey(primary) !== getAddressKey(matched)
        ? formatAddress(primary, "full")
        : undefined;

    return {
      visibleLine: matchedLine,
      primaryLine,
      showMatchedBadge: matchedBy === "address",
    };
  }

  return {
    visibleLine: primary ? formatAddress(primary, "full") : "—",
    showMatchedBadge: false,
  };
}

function formatAddressCountBadgeLabel(
  count: number,
  translate: ReturnType<typeof useTranslation>["t"],
): string {
  if (count <= 1) {
    return translate("customers.addresses.countBadgeOne");
  }

  return translate("customers.addresses.countBadge", { count });
}

function CustomerPickerLoader({
  compact = false,
  title,
}: {
  compact?: boolean;
  title: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-b bg-gradient-to-b from-primary/[0.06] via-background to-background",
        compact ? "px-4 py-6" : "px-4 py-5",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3 grid h-14 w-14 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <LoaderCircle
            className="absolute inset-0 size-14 animate-spin text-primary drop-shadow-sm"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="relative grid size-10 place-items-center rounded-full border border-primary/25 bg-card shadow-lg shadow-primary/10">
            <UsersRound className="size-5 text-primary" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
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
        {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
          <div key={index} className="border-b px-4 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                <div className="space-y-1">
                  <div className="h-3 w-full max-w-56 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-36 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
              <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">{title}</span>
    </div>
  );
}

export function CustomerPartySelect({
  id,
  partyType,
  value,
  selectedCustomer,
  onValueChange,
  placeholder,
  pickerTitle,
  searchPlaceholder,
  required = false,
  disabled = false,
  className,
  triggerClassName,
  showAddressLabels = true,
}: CustomerPartySelectProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobileViewport();
  const ensureCustomerDetail = useEnsureCustomerDetail();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(query, 300).trim();
  const isSearchPending = trimmedQuery.length > 0 && trimmedQuery !== debouncedQuery;
  const isSearching = debouncedQuery.length > 0;

  const pickerQuery = useCustomerPicker(200);
  const autocompleteQuery = useCustomerAutocomplete(debouncedQuery, partyType, {
    enabled: open && isSearching,
    limit: 20,
  });
  const detailQuery = useCustomer(
    detailCustomerId,
    open && Boolean(detailCustomerId && expandedIds.has(detailCustomerId)),
  );

  const pickerCustomers = useMemo(() => {
    const items = pickerQuery.data?.items ?? [];
    return items.filter(
      (customer) =>
        customer.active &&
        (partyType === "sender"
          ? isCustomerSenderType(customer.customerType)
          : isCustomerReceiverType(customer.customerType)),
    );
  }, [partyType, pickerQuery.data?.items]);

  const results = useMemo(() => {
    if (isSearchPending) {
      return [];
    }
    if (isSearching) {
      return autocompleteQuery.data ?? [];
    }
    return toSearchResults(pickerCustomers);
  }, [autocompleteQuery.data, isSearchPending, isSearching, pickerCustomers]);

  const visibleCustomerIds = useMemo(
    () => results.slice(0, 20).map((result) => result.customer.id),
    [results],
  );

  useCustomerDetailsBatch(visibleCustomerIds, open);

  const loading = isSearchPending || (isSearching ? autocompleteQuery.isFetching : pickerQuery.isFetching);
  const displayLabel = selectedCustomer?.name ?? "";
  const hasSelection = Boolean(value && selectedCustomer);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(0);
  }, [debouncedQuery, open, results.length]);

  function resolveDisplayCustomer(customer: Customer): Customer {
    const cached = queryClient.getQueryData<Customer>(queryKeys.customers.detail(customer.id));
    if (cached) return cached;
    if (detailQuery.data?.id === customer.id) return detailQuery.data;
    return customer;
  }

  async function selectCustomer(customer: Customer, addressId?: string) {
    let resolved = customer;
    try {
      resolved = await ensureCustomerDetail(customer.id);
    } catch {
      resolved = customer;
    }

    onValueChange(resolved.id, resolved, addressId);
    setOpen(false);
    setQuery("");
    setExpandedIds(new Set());
    setDetailCustomerId(null);
  }

  function expandCustomer(customerId: string) {
    setExpandedIds((current) => {
      if (current.has(customerId)) return current;
      const next = new Set(current);
      next.add(customerId);
      return next;
    });
    setDetailCustomerId(customerId);
    void ensureCustomerDetail(customerId);
  }

  /**
   * A customer with more than one address must be confirmed by pressing a specific
   * address, so activating the row only expands it. Single-address customers select
   * immediately.
   */
  function activateCustomerRow(customer: Customer, addressCount: number) {
    if (addressCount > 1) {
      expandCustomer(customer.id);
      return;
    }
    void selectCustomer(customer);
  }

  async function toggleExpanded(customerId: string) {
    const willExpand = !expandedIds.has(customerId);

    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });

    if (willExpand) {
      setDetailCustomerId(customerId);
      try {
        await ensureCustomerDetail(customerId);
      } catch {
        // Keep the expanded shell; the list will show whatever we already have.
      }
      return;
    }

    if (detailCustomerId === customerId) {
      setDetailCustomerId(null);
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && results[highlightedIndex]) {
      event.preventDefault();
      const displayCustomer = resolveDisplayCustomer(results[highlightedIndex]!.customer);
      activateCustomerRow(displayCustomer, resolveCustomerAddressCount(displayCustomer));
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  function resetPickerState() {
    setQuery("");
    setExpandedIds(new Set());
    setDetailCustomerId(null);
  }

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) resetPickerState();
  }

  function renderCustomerResults(isMobileSheet = false) {
    return (
      <>
        {loading ? (
          <CustomerPickerLoader compact={isMobileSheet} title={t("customers.addresses.loading")} />
        ) : null}

        {!loading && results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {t("customers.addresses.emptyResults")}
          </p>
        ) : null}

        {!loading ? results.map((result, index) => {
          const displayCustomer = resolveDisplayCustomer(result.customer);
          const { matchedAddressId } = result;
          const previewResult: CustomerSearchResult = { ...result, customer: displayCustomer };
          const phone = getPrimaryPhoneDisplayNumber(displayCustomer.phones);
          const addressCount = resolveCustomerAddressCount(displayCustomer);
          const isExpanded = expandedIds.has(displayCustomer.id);
          const isHighlighted = index === highlightedIndex;
          const preview = buildCollapsedPreview(previewResult);
          const isLoadingDetail =
            isExpanded &&
            detailCustomerId === displayCustomer.id &&
            detailQuery.isFetching;

          return (
            <div key={displayCustomer.id} className="border-b border-border/60 last:border-b-0">
              <div
                role="option"
                aria-selected={value === displayCustomer.id}
                className={cn(
                  "cursor-pointer px-3 py-2.5 transition-colors hover:bg-muted/60",
                  isMobileSheet && "px-4 py-4",
                  isHighlighted && "bg-muted/60",
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => activateCustomerRow(displayCustomer, addressCount)}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium text-foreground">{displayCustomer.name}</p>
                      <div className="flex shrink-0 items-center gap-1">
                        {addressCount > 0 ? (
                          <button
                            type="button"
                            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={
                              isExpanded
                                ? t("customers.addresses.collapseAddresses")
                                : t("customers.addresses.expandAddresses")
                            }
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleExpanded(displayCustomer.id);
                            }}
                          >
                            <Badge
                              variant="outline"
                              className="h-5 cursor-pointer whitespace-nowrap border-sky-500/30 bg-sky-500/10 px-1.5 text-[10px] font-medium text-sky-800 hover:bg-sky-500/20 dark:text-sky-200"
                            >
                              {formatAddressCountBadgeLabel(addressCount, t)}
                            </Badge>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={
                            isExpanded
                              ? t("customers.addresses.collapseAddresses")
                              : t("customers.addresses.expandAddresses")
                          }
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleExpanded(displayCustomer.id);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {phone ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{phone}</p>
                    ) : null}

                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <p className="flex flex-wrap items-center gap-1.5">
                        {preview.showMatchedBadge ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-800 dark:text-amber-200"
                          >
                            {t("customers.addresses.matchedBadge")}
                          </Badge>
                        ) : null}
                        <span className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "text-foreground/90")}>
                          {preview.visibleLine}
                        </span>
                      </p>
                      {preview.primaryLine ? (
                        <p className={ADDRESS_TEXT_WRAP_CLASSNAME}>
                          {t("customers.addresses.primaryPrefix")} {preview.primaryLine}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded ? (
                <div className="space-y-1 border-t border-border/60 bg-muted/20 px-3 py-2">
                  {isLoadingDetail ? (
                    <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("customers.addresses.loadingAddresses")}
                    </div>
                  ) : null}

                  {!isLoadingDetail
                    ? orderAddressesForDisplay(displayCustomer, matchedAddressId).map(
                        (address, addressIndex) => (
                          <button
                            key={address.id ?? `${displayCustomer.id}-${addressIndex}`}
                            type="button"
                            className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted/70"
                            onClick={() => void selectCustomer(displayCustomer, address.id)}
                          >
                            {showAddressLabels ? (
                              <Badge variant="secondary" className="mt-0.5 shrink-0">
                                {t(getAddressLabelKey(address, addressIndex))}
                              </Badge>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className={cn("block", ADDRESS_TEXT_WRAP_CLASSNAME, "text-foreground")}>
                                {formatAddress(address, "full")}
                              </span>
                              {address.phone?.trim() ? (
                                <span className="mt-0.5 block text-muted-foreground">
                                  {address.phone.trim()}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        ),
                      )
                    : null}
                </div>
              ) : null}
            </div>
          );
        }) : null}
      </>
    );
  }

  if (isMobile) {
    return (
      <div className={cn("relative", className)}>
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <button
            type="button"
            id={id}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            onClick={() => handleOpenChange(true)}
            className={cn(
              "relative flex h-9 w-full min-w-0 max-w-full items-center rounded-md border border-input bg-background px-3 pr-9 text-left text-sm shadow-xs max-md:h-12 max-md:rounded-xl max-md:text-base",
              disabled && "cursor-not-allowed opacity-50",
              triggerClassName,
            )}
          >
            <span className={cn("min-w-0 flex-1 truncate", !hasSelection && "text-muted-foreground")}>
              {hasSelection ? displayLabel : placeholder}
            </span>
            <ChevronDown className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </button>

          <SheetContent
            side="bottom"
            className="z-[90] flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] max-md:bottom-[env(safe-area-inset-bottom)] max-md:top-[calc(env(safe-area-inset-top)+0.75rem)] max-md:max-h-none max-md:rounded-2xl max-md:border"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="shrink-0 border-b px-4 py-4 pr-14">
              <SheetTitle>{pickerTitle ?? placeholder ?? t("customers.addresses.openOptions")}</SheetTitle>
            </SheetHeader>
            <div className="shrink-0 border-b px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder ?? pickerTitle ?? placeholder}
                  disabled={disabled}
                  className="h-11 rounded-xl pl-9 text-base"
                />
              </div>
            </div>
            <div
              id={listboxId}
              role="listbox"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {renderCustomerResults(true)}
            </div>
          </SheetContent>
        </Sheet>

        {required ? (
          <input
            aria-hidden
            tabIndex={-1}
            required
            value={value}
            onChange={() => {}}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        modal
      >
        <PopoverAnchor asChild>
          <div
            className={cn(
              "flex h-9 w-full min-w-0 max-w-full items-center rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-xs max-md:h-12 max-md:rounded-xl max-md:text-base",
              disabled && "cursor-not-allowed opacity-50",
              triggerClassName,
            )}
            onClick={() => {
              if (disabled) return;
              inputRef.current?.focus();
              setOpen(true);
            }}
          >
            <input
              ref={inputRef}
              id={id}
              value={open ? query : hasSelection ? displayLabel : query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => {
                if (disabled) return;
                setOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={hasSelection && !open ? undefined : placeholder}
              disabled={disabled}
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listboxId : undefined}
              aria-autocomplete="list"
              className={cn(
                "min-w-0 flex-1 truncate bg-transparent outline-none placeholder:text-muted-foreground",
                hasSelection && !open && "text-foreground",
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={open ? t("customers.addresses.closeOptions") : t("customers.addresses.openOptions")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) return;
                setOpen((current) => !current);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
        >
          <div
            id={listboxId}
            role="listbox"
            className="max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain py-1"
          >
            {renderCustomerResults()}
          </div>
        </PopoverContent>
      </Popover>

      {required ? (
        <input
          aria-hidden
          tabIndex={-1}
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 size-full opacity-0"
        />
      ) : null}
    </div>
  );
}
