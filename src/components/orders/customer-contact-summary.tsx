"use client";

import { MapPin, Phone } from "lucide-react";

import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatCoreAddressLines } from "@/lib/customers/display";
import {
  coreAddressRequiresVerification,
  getCustomerPrimaryCoreAddress,
  type Customer,
} from "@/lib/customers/types";
import { getOrderPartyAddressAtIndex } from "@/lib/orders/types";

const optionalMissingClassName =
  "rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";

type CustomerContactSummaryProps = {
  customer: Customer;
  /** When set, shows this address instead of the customer's primary address. */
  addressIndex?: number;
  /** When set, empty phone/address show as yellow optional-missing warnings. */
  missingPhoneLabel?: string;
  missingAddressLabel?: string;
};

export function CustomerContactSummary({
  customer,
  addressIndex,
  missingPhoneLabel,
  missingAddressLabel,
}: CustomerContactSummaryProps) {
  const address =
    addressIndex == null
      ? getCustomerPrimaryCoreAddress(customer)
      : getOrderPartyAddressAtIndex(customer, addressIndex);
  const phones = getOrderedRecordPhones(customer.phones);

  const phoneLine = phones
    .map((phone) => phone.displayNumber?.trim() || phone.number.trim())
    .filter(Boolean)
    .join(" · ");

  const addressLine = formatCoreAddressLines(address).join(", ");
  const hasAddress = Boolean(addressLine) && coreAddressRequiresVerification(address);
  const warnMissing = Boolean(missingPhoneLabel || missingAddressLabel);
  const showMissingPhone = !phoneLine && warnMissing && Boolean(missingPhoneLabel);
  const showMissingAddress = !hasAddress && warnMissing && Boolean(missingAddressLabel);
  const hasDetails = Boolean(phoneLine) || hasAddress || showMissingPhone || showMissingAddress;

  return (
    <div className="rounded-xl border border-primary/15 bg-card p-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
        {hasDetails ? (
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {phoneLine || showMissingPhone ? (
              <p className="flex items-start gap-1.5">
                <Phone className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {phoneLine ? (
                  <span className="min-w-0 break-words">{phoneLine}</span>
                ) : (
                  <span className={optionalMissingClassName}>{missingPhoneLabel}</span>
                )}
              </p>
            ) : null}
            {hasAddress || showMissingAddress ? (
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {hasAddress ? (
                  <span className="min-w-0 break-words">{addressLine}</span>
                ) : (
                  <span className={optionalMissingClassName}>{missingAddressLabel}</span>
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
