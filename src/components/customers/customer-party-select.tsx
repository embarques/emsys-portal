"use client";

import { ChevronDown, ChevronRight, ChevronUp, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

export function CustomerPartySelect({
  id,
  partyType,
  value,
  selectedCustomer,
  onValueChange,
  placeholder,
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
  const ensureCustomerDetail = useEnsureCustomerDetail();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const debouncedQuery = useDebouncedValue(query, 300).trim();
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
    if (isSearching) {
      return autocompleteQuery.data ?? [];
    }
    return toSearchResults(pickerCustomers);
  }, [autocompleteQuery.data, isSearching, pickerCustomers]);

  const visibleCustomerIds = useMemo(
    () => results.slice(0, 20).map((result) => result.customer.id),
    [results],
  );

  useCustomerDetailsBatch(visibleCustomerIds, open);

  const loading = isSearching ? autocompleteQuery.isFetching : pickerQuery.isFetching;
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

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) {
            setQuery("");
            setExpandedIds(new Set());
            setDetailCustomerId(null);
          }
        }}
        modal
      >
        <PopoverAnchor asChild>
          <div
            className={cn(
              "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 pr-9 text-sm shadow-xs",
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
            {loading ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t("customers.addresses.loading")}
              </p>
            ) : null}

            {!loading && results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t("customers.addresses.emptyResults")}
              </p>
            ) : null}

            {results.map((result, index) => {
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
            })}
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
