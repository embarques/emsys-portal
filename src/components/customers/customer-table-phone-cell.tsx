"use client";

import type { Customer } from "@/lib/customers/types";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import {
  getOrderedRecordPhones,
  getRecordPhoneDisplayNumber,
} from "@/lib/phones/phones";
import { cn } from "@/lib/utils";

type CustomerTablePhoneCellProps = {
  customer: Customer;
  className?: string;
};

export function CustomerTablePhoneCell({ customer, className }: CustomerTablePhoneCellProps) {
  const phones = getOrderedRecordPhones(customer.phones)
    .map((phone) => ({
      phone,
      display: getRecordPhoneDisplayNumber(phone).trim(),
    }))
    .filter((entry) => entry.display.length > 0);

  if (phones.length === 0) {
    return <span>—</span>;
  }

  if (phones.length === 1) {
    return (
      <span className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug", className)}>
        {phones[0]!.display}
      </span>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-0.5", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
      {phones.map(({ phone, display }, index) => (
        <span key={`${phone.number}-${index}`} className="leading-snug">
          {display}
        </span>
      ))}
    </div>
  );
}
