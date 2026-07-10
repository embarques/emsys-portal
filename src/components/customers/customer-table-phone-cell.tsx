"use client";

import type { Customer } from "@/lib/customers/types";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";
import {
  getOrderedRecordPhones,
  getRecordPhoneDisplayNumber,
} from "@/lib/phones/phones";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_PHONES = 2;

type CustomerTablePhoneCellProps = {
  customer: Customer;
  className?: string;
};

export function CustomerTablePhoneCell({ customer, className }: CustomerTablePhoneCellProps) {
  const { t } = useTranslation();
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
  const phoneCountLabel =
    phones.length === 1
      ? t("phones.countBadgeOne")
      : t("phones.countBadge", { count: phones.length });

  return (
    <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
      <div className={cn("flex w-full flex-col gap-0.5", ADDRESS_TEXT_WRAP_CLASSNAME)}>
        {visiblePhones.map(({ phone, display }, index) => (
          <span key={`${phone.number}-${index}`} className="leading-snug">
            {display}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-xs font-medium text-primary">{phoneCountLabel}</p>
    </div>
  );
}
