"use client";

import { useState } from "react";
import { Loader2, Phone as PhoneIcon } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { useCustomer } from "@/lib/customers/hooks/use-customers";
import type { Customer } from "@/lib/customers/types";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";
import {
  getOrderedRecordPhones,
  getRecordPhoneDisplayNumber,
} from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_PHONES = 2;
const PHONE_COUNT_LINK_MIN = 3;

type CustomerTablePhoneCellProps = {
  customer: Customer;
  className?: string;
};

function phoneTypeLabel(
  phone: Pick<RecordPhone, "type" | "isPrimary">,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const typeLabel = t(`phones.types.${phone.type}`);
  return phone.isPrimary ? t("customers.view.primaryPhone", { type: typeLabel }) : typeLabel;
}

type CustomerPhonesSheetProps = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CustomerPhonesSheet({ customer, open, onOpenChange }: CustomerPhonesSheetProps) {
  const { t } = useTranslation();
  const detailQuery = useCustomer(customer?.id ?? null, open && Boolean(customer?.id));
  const resolvedCustomer = detailQuery.data ?? customer;

  if (!customer) return null;

  const phones = getOrderedRecordPhones(resolvedCustomer?.phones ?? customer.phones);
  const countLabel =
    phones.length === 1
      ? t("phones.countBadgeOne")
      : t("phones.countBadge", { count: phones.length });

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{resolvedCustomer?.name ?? customer.name}</span>
              {phones.length > 0 ? (
                <Badge variant="secondary" className="text-xs font-normal">
                  {countLabel}
                </Badge>
              ) : null}
            </span>
          }
          description={t("phones.sheetTitle")}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("customers.view.phones")} icon={PhoneIcon}>
            {detailQuery.isFetching && phones.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("phones.loading")}
              </div>
            ) : null}

            {!detailQuery.isFetching && phones.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t("common.empty.dash")}</p>
            ) : null}

            {phones.map((phone, index) => (
              <PhoneActionRow
                key={`${phone.number}-${phone.type}-${index}`}
                label={phoneTypeLabel(phone, t)}
                number={phone.number}
                displayNumber={phone.displayNumber}
              />
            ))}
          </RecordViewSheetSection>
        </RecordViewSheetBody>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}

export function CustomerTablePhoneCell({ customer, className }: CustomerTablePhoneCellProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const phones = getOrderedRecordPhones(customer.phones)
    .map((phone) => ({
      phone,
      display: getRecordPhoneDisplayNumber(phone).trim(),
    }))
    .filter((entry) => entry.display.length > 0);

  if (phones.length === 0) {
    return <span>{t("common.empty.dash")}</span>;
  }

  const visiblePhones = phones.slice(0, MAX_VISIBLE_PHONES);
  const showCountLink = phones.length >= PHONE_COUNT_LINK_MIN;
  const phoneCountLabel = t("phones.countBadge", { count: phones.length });

  function openSheet(event: React.MouseEvent) {
    event.stopPropagation();
    setSheetOpen(true);
  }

  return (
    <>
      <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
        <div className={cn("flex w-full flex-col gap-0.5", ADDRESS_TEXT_WRAP_CLASSNAME)}>
          {visiblePhones.map(({ phone, display }, index) => (
            <span key={`${phone.number}-${index}`} className="leading-snug">
              {display}
            </span>
          ))}
        </div>
        {showCountLink ? (
          <button
            type="button"
            data-stop-row-click
            className="mt-0.5 text-left text-xs font-medium text-primary hover:underline"
            onClick={openSheet}
          >
            {phoneCountLabel}
          </button>
        ) : null}
      </div>

      {showCountLink ? (
        <CustomerPhonesSheet customer={customer} open={sheetOpen} onOpenChange={setSheetOpen} />
      ) : null}
    </>
  );
}
