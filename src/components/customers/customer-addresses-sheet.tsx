"use client";

import { useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";

import { AddressActionRow } from "@/components/addresses/address-action-row";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomer } from "@/lib/customers/hooks/use-customers";
import type { Customer } from "@/lib/customers/types";
import {
  formatCoreAddressLines,
  getAddressLabelKey,
  ADDRESS_TEXT_WRAP_CLASSNAME,
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
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{resolvedCustomer?.name ?? customer.name}</span>
              {addressCount > 0 ? (
                <Badge variant="secondary" className="text-xs font-normal">
                  {countLabel}
                </Badge>
              ) : null}
            </span>
          }
          description={phone || t("customers.addresses.sheetTitle")}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("customers.view.addresses")} icon={MapPin}>
            {detailQuery.isFetching && addresses.length <= 1 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("customers.addresses.loadingAddresses")}
              </div>
            ) : null}

            {!detailQuery.isFetching && addresses.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t("common.empty.dash")}</p>
            ) : null}

            {addresses.map((address, index) => (
              <AddressActionRow
                key={address.id ?? `${getAddressLabelKey(address, index)}-${index}`}
                label={t(getAddressLabelKey(address, index))}
                address={address}
              />
            ))}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <div className="shrink-0 border-t border-border bg-card px-6 py-4">
          <Button type="button" variant="outline" className="w-full" disabled>
            <Plus className="size-4" />
            {t("customers.addresses.addAddressTodo")}
          </Button>
        </div>
      </RecordViewSheetContent>
    </RecordViewSheet>
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
  const addressLines = primary ? formatCoreAddressLines(primary) : [];
  const addressTitle = addressLines.length > 0 ? addressLines.join(", ") : "—";

  function openSheet(event: React.MouseEvent) {
    event.stopPropagation();
    setSheetOpen(true);
  }

  const addressCountLabel = t("customers.addresses.countBadge", { count: total });

  return (
    <>
      <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
        {addressLines.length > 0 ? (
          <div className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")} title={addressTitle}>
            {addressLines.map((line, index) => (
              <p key={index} className={ADDRESS_TEXT_WRAP_CLASSNAME}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")}>—</p>
        )}
        {detailQuery.isFetching && total <= 1 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{t("customers.addresses.loadingAddresses")}</p>
        ) : null}
        {!detailQuery.isFetching && total > 1 ? (
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
