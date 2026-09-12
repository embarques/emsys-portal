"use client";

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
    .join("  ·  ");

  const addressLines = formatCoreAddressLines(address);
  const hasAddress = addressLines.length > 0 && coreAddressRequiresVerification(address);
  const warnMissing = Boolean(missingPhoneLabel || missingAddressLabel);
  const showMissingPhone = !phoneLine && warnMissing && Boolean(missingPhoneLabel);
  const showMissingAddress = !hasAddress && warnMissing && Boolean(missingAddressLabel);
  const hasDetails = Boolean(phoneLine) || hasAddress || showMissingPhone || showMissingAddress;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium text-foreground">{customer.name}</p>
      {hasDetails ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {phoneLine ? (
            <p className="break-words">{phoneLine}</p>
          ) : showMissingPhone ? (
            <p>
              <span className={optionalMissingClassName}>{missingPhoneLabel}</span>
            </p>
          ) : null}
          {hasAddress
            ? addressLines.map((line, index) => (
                <p key={index} className="break-words">
                  {line}
                </p>
              ))
            : showMissingAddress ? (
                <p>
                  <span className={optionalMissingClassName}>{missingAddressLabel}</span>
                </p>
              ) : null}
        </div>
      ) : null}
    </div>
  );
}
