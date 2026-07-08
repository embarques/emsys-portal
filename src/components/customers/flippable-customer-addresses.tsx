"use client";

import { Loader2, MapPin } from "lucide-react";

import { AddressActionRow } from "@/components/addresses/address-action-row";
import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import type { Customer } from "@/lib/customers/types";
import {
  getAddressLabelKey,
  getAllAddresses,
  orderAddressesForDisplay,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";

type FlippableCustomerAddressesProps = {
  customer: Customer;
  isLoading?: boolean;
};

export function FlippableCustomerAddresses({
  customer,
  isLoading = false,
}: FlippableCustomerAddressesProps) {
  const { t } = useTranslation();
  const orderedAddresses = orderAddressesForDisplay(customer);
  const addressCount = resolveCustomerAddressCount(customer);
  const loadedAddressCount = getAllAddresses(customer).length;
  const isLoadingMore =
    isLoading && (orderedAddresses.length === 0 || addressCount > loadedAddressCount);

  if (orderedAddresses.length === 0 && !isLoadingMore) {
    return null;
  }

  return (
    <RecordViewSheetSection title={t("customers.view.addresses")} icon={MapPin}>
      {isLoadingMore && orderedAddresses.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("customers.addresses.loadingAddresses")}
        </div>
      ) : (
        orderedAddresses.map((address, index) => (
          <AddressActionRow
            key={address.id ?? `${customer.id}-address-${index}`}
            label={t(getAddressLabelKey(address, index))}
            address={address}
          />
        ))
      )}

      {isLoadingMore && orderedAddresses.length > 0 ? (
        <p className="px-4 py-2 text-xs text-muted-foreground">
          {t("customers.addresses.loadingAddresses")}
        </p>
      ) : null}
    </RecordViewSheetSection>
  );
}
