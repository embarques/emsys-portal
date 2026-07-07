"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCoreAddressLines } from "@/lib/customers/display";
import { useCustomer } from "@/lib/customers/hooks/use-customers";
import type { Customer } from "@/lib/customers/types";
import {
  formatAddress,
  formatAddressLine,
  ADDRESS_TEXT_WRAP_CLASSNAME,
  getAddressLabelKey,
  getPrimaryAddress,
  orderAddressesForDisplay,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CustomerAddressesSheetProps = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerAddressesSheet({
  customer,
  open,
  onOpenChange,
}: CustomerAddressesSheetProps) {
  const { t } = useTranslation();
  const detailQuery = useCustomer(customer?.id ?? null, open);
  const resolvedCustomer = detailQuery.data ?? customer;

  if (!customer) return null;

  const phone = getPrimaryPhoneDisplayNumber(resolvedCustomer?.phones ?? customer.phones);
  const addresses = resolvedCustomer ? orderAddressesForDisplay(resolvedCustomer) : [];
  const addressCount = resolvedCustomer
    ? resolveCustomerAddressCount(resolvedCustomer)
    : resolveCustomerAddressCount(customer);
  const countLabel =
    addressCount === 1
      ? t("customers.addresses.countBadgeOne")
      : t("customers.addresses.countBadge", { count: addressCount });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            <span>{resolvedCustomer?.name ?? customer.name}</span>
            {addressCount > 0 ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {countLabel}
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>{phone || t("customers.addresses.sheetTitle")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          {detailQuery.isFetching && addresses.length <= 1 ? (
            <p className="text-sm text-muted-foreground">{t("customers.addresses.loading")}</p>
          ) : null}

          {!detailQuery.isFetching && addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : null}

          {addresses.map((address, index) => {
            const lines = formatCoreAddressLines(address);
            const labelKey = getAddressLabelKey(address, index);

            return (
              <div
                key={address.id ?? `${labelKey}-${index}`}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(labelKey)}</Badge>
                  {address.isPrimary ? (
                    <Badge className="border-transparent bg-primary/15 text-primary">
                      {t("customers.addresses.labels.primary")}
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-1 text-sm">
                  {lines.map((line) => (
                    <p key={line} className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "text-foreground")}>
                      {line}
                    </p>
                  ))}
                  {!lines.length ? (
                    <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "text-muted-foreground")}>
                      {formatAddress(address, "full")}
                    </p>
                  ) : null}
                </div>

                {address.phone?.trim() ? (
                  <p className="mt-3 text-sm text-muted-foreground">{address.phone.trim()}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-4">
          <Button type="button" variant="outline" className="w-full" disabled>
            <Plus className="size-4" />
            {t("customers.addresses.addAddressTodo")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type CustomerTableAddressCellProps = {
  customer: Customer;
  className?: string;
};

export function CustomerTableAddressCell({ customer, className }: CustomerTableAddressCellProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const detailQuery = useCustomer(customer.id, true);
  const resolvedCustomer = detailQuery.data ?? customer;
  const total = resolveCustomerAddressCount(resolvedCustomer);
  const primary = getPrimaryAddress(resolvedCustomer);
  const primaryLine = primary ? formatAddressLine(primary, "full") : "—";

  function openSheet(event: React.MouseEvent) {
    event.stopPropagation();
    setSheetOpen(true);
  }

  const addressCountLabel =
    total === 1
      ? t("customers.addresses.countBadgeOne")
      : t("customers.addresses.countBadge", { count: total });

  return (
    <>
      <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
        <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")} title={primaryLine}>
          {primaryLine}
        </p>
        {detailQuery.isFetching && total <= 1 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{t("customers.addresses.loadingAddresses")}</p>
        ) : null}
        {!detailQuery.isFetching && total > 0 ? (
          <button
            type="button"
            className="mt-0.5 text-left text-xs font-medium text-primary hover:underline"
            onClick={openSheet}
          >
            {addressCountLabel}
          </button>
        ) : null}
      </div>

      <CustomerAddressesSheet customer={resolvedCustomer} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
