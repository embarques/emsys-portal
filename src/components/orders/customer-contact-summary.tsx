"use client";

import { MapPin, Phone, Star } from "lucide-react";

import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatCoreAddressLines } from "@/lib/customers/display";
import {
  coreAddressHasContent,
  getCustomerPrimaryCoreAddress,
  type Customer,
} from "@/lib/customers/types";
import { getOrderPartyAddressAtIndex } from "@/lib/orders/types";
import { resolvePhoneDisplayValue } from "@/lib/utils/phone";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const address =
    addressIndex == null
      ? getCustomerPrimaryCoreAddress(customer)
      : getOrderPartyAddressAtIndex(customer, addressIndex);
  const phones = getOrderedRecordPhones(customer.phones);

  const phoneEntries = phones
    .map((phone) => ({
      phone,
      display: resolvePhoneDisplayValue(phone.number, phone.displayNumber).trim(),
    }))
    .filter(({ display }) => display.length > 0);

  const addressLine = formatCoreAddressLines(address).join(", ");
  const hasAddress = coreAddressHasContent(address) && Boolean(addressLine);
  const warnMissing = Boolean(missingPhoneLabel || missingAddressLabel);
  const showMissingPhone = phoneEntries.length === 0 && warnMissing && Boolean(missingPhoneLabel);
  const showMissingAddress = !hasAddress && warnMissing && Boolean(missingAddressLabel);
  const hasDetails =
    phoneEntries.length > 0 || hasAddress || showMissingPhone || showMissingAddress;

  return (
    <div className="rounded-xl border border-primary/15 bg-card p-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
        {hasDetails ? (
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {phoneEntries.length > 0 || showMissingPhone ? (
              <p className="flex items-start gap-1.5">
                <Phone className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {phoneEntries.length > 0 ? (
                  <span className="min-w-0 break-words">
                    {phoneEntries.map(({ phone, display }, index) => (
                      <span key={`${phone.number}-${index}`} className="inline-flex items-center gap-1">
                        {index > 0 ? <span aria-hidden="true"> · </span> : null}
                        <span>{display}</span>
                        {phone.isPrimary ? (
                          <Star
                            className="size-3 shrink-0 fill-current text-amber-500"
                            aria-label={t("phones.primary")}
                          />
                        ) : null}
                      </span>
                    ))}
                  </span>
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
