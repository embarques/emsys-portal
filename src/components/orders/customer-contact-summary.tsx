"use client";

import { IdCard, Mail, MapPin, NotebookPen, Phone } from "lucide-react";

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
import { cn } from "@/lib/utils";

const optionalMissingClassName =
  "rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";

/** Distinct icon colors so address / phone / notes / etc. scan apart at a glance. */
const iconClass = {
  id: "text-slate-500 dark:text-slate-400",
  mail: "text-indigo-600 dark:text-indigo-400",
  address: "text-sky-600 dark:text-sky-400",
  phone: "text-emerald-600 dark:text-emerald-400",
  notes: "text-violet-600 dark:text-violet-400",
} as const;

type CustomerContactSummaryProps = {
  customer: Customer;
  /** When set, shows this address instead of the customer's primary address. */
  addressIndex?: number;
  /** When set, empty phone/address show as yellow optional-missing warnings. */
  missingPhoneLabel?: string;
  missingAddressLabel?: string;
  /** Emphasize phones and selected address in a compact read-only layout for appointment forms. */
  detailed?: boolean;
  className?: string;
};

export function CustomerContactSummary({
  customer,
  addressIndex,
  missingPhoneLabel,
  missingAddressLabel,
  detailed = false,
  className,
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

  const addressLines = formatCoreAddressLines(address);
  const addressLine = addressLines.join(", ");
  const hasAddress = coreAddressHasContent(address) && addressLines.length > 0;
  const email = customer.email.trim();
  const idNumber = customer.IDNumber.trim();
  const notes = customer.notes.trim();
  const warnMissing = Boolean(missingPhoneLabel || missingAddressLabel);
  const showMissingPhone = phoneEntries.length === 0 && warnMissing && Boolean(missingPhoneLabel);
  const showMissingAddress = !hasAddress && warnMissing && Boolean(missingAddressLabel);

  if (detailed) {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-primary/15 bg-card p-2.5 shadow-sm",
          className,
        )}
      >
        {idNumber || email ? (
          <div className="min-w-0 shrink-0 space-y-0.5 text-xs text-foreground/80">
            {idNumber ? (
              <p className="flex min-w-0 items-center gap-1.5 break-words">
                <IdCard className={cn("size-3 shrink-0", iconClass.id)} aria-hidden="true" />
                <span>
                  <span className="font-medium text-foreground">{t("orders.view.idNumber")}: </span>
                  {idNumber}
                </span>
              </p>
            ) : null}
            {email ? (
              <p className="flex min-w-0 items-center gap-1.5 break-words">
                <Mail className={cn("size-3 shrink-0", iconClass.mail)} aria-hidden="true" />
                <span className="truncate">{email}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {hasAddress ? (
          <div className="flex min-w-0 items-start gap-1.5 text-xs leading-snug text-foreground">
            <MapPin className={cn("mt-0.5 size-3.5 shrink-0", iconClass.address)} aria-hidden="true" />
            <div className="min-w-0">
              {addressLines.map((line) => (
                <p key={line} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : showMissingAddress ? (
          <p className={cn("text-xs", optionalMissingClassName)}>{missingAddressLabel}</p>
        ) : (
          <p className="text-xs text-foreground/70">{t("common.empty.dash")}</p>
        )}

        {phoneEntries.length > 0 ? (
          <p className="flex min-w-0 items-start gap-1.5 text-xs leading-snug">
            <Phone className={cn("mt-0.5 size-3.5 shrink-0", iconClass.phone)} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-wrap content-start gap-x-2 gap-y-0.5">
              {phoneEntries.map(({ phone, display }, index) => (
                <span
                  key={`${phone.number}-${index}`}
                  className="inline-flex max-w-full items-baseline gap-2"
                >
                  {index > 0 ? (
                    <span className="text-muted-foreground" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {/* Keep each number intact; wrap onto the next line as a whole unit. */}
                  <span className="max-w-full whitespace-nowrap font-medium text-foreground">
                    {display}
                  </span>
                </span>
              ))}
            </span>
          </p>
        ) : showMissingPhone ? (
          <p className={cn("text-xs", optionalMissingClassName)}>{missingPhoneLabel}</p>
        ) : (
          <p className="text-xs text-foreground/70">{t("common.empty.dash")}</p>
        )}

        {notes ? (
          <p className="flex min-w-0 items-start gap-1.5 text-xs leading-snug text-foreground">
            <NotebookPen className={cn("mt-0.5 size-3 shrink-0", iconClass.notes)} aria-hidden="true" />
            <span className="min-w-0 whitespace-pre-wrap break-words">{notes}</span>
          </p>
        ) : null}
      </div>
    );
  }

  const hasDetails =
    phoneEntries.length > 0 || hasAddress || showMissingPhone || showMissingAddress;

  return (
    <div className={cn("rounded-xl border border-primary/15 bg-card p-3 shadow-sm", className)}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
        {hasDetails ? (
          <div className="mt-1.5 space-y-1.5 text-xs text-muted-foreground">
            {hasAddress || showMissingAddress ? (
              <p className="flex items-start gap-1.5">
                <MapPin className={cn("mt-px size-3.5 shrink-0", iconClass.address)} aria-hidden="true" />
                {hasAddress ? (
                  <span className="min-w-0 break-words">{addressLine}</span>
                ) : (
                  <span className={optionalMissingClassName}>{missingAddressLabel}</span>
                )}
              </p>
            ) : null}
            {phoneEntries.length > 0 || showMissingPhone ? (
              <p className="flex items-start gap-1.5">
                <Phone className={cn("mt-px size-3.5 shrink-0", iconClass.phone)} aria-hidden="true" />
                {phoneEntries.length > 0 ? (
                  <span className="min-w-0 break-words">
                    {phoneEntries.map(({ phone, display }, index) => (
                      <span key={`${phone.number}-${index}`}>
                        {index > 0 ? <span aria-hidden="true"> · </span> : null}
                        <span className="whitespace-nowrap">{display}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={optionalMissingClassName}>{missingPhoneLabel}</span>
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
