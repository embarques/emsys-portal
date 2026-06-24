"use client";

import { getPhoneDisplayAtIndex } from "@/lib/phones/phones";
import type { Customer } from "@/lib/customers/types";

export function CustomerContactSummary({ customer }: { customer: Customer }) {
  const address = customer.address;
  const phone1 = getPhoneDisplayAtIndex(customer.phones, 0);
  const phone2 = getPhoneDisplayAtIndex(customer.phones, 1);

  const lines = [
    [phone1, phone2].filter((value) => value.trim()).join("  ·  "),
    [address.address1, address.apartment].filter((value) => value.trim()).join(", "),
    address.address2.trim(),
    [
      address.city,
      [address.state, address.zipcode].filter((value) => value.trim()).join(" "),
      address.country,
    ]
      .filter((value) => value.trim())
      .join(", "),
  ].filter((line) => line.trim());

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium text-foreground">{customer.name}</p>
      {lines.length > 0 ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {lines.map((line, index) => (
            <p key={index} className="truncate">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
