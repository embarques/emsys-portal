"use client";

import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatCoreAddressLines } from "@/lib/customers/display";
import { getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { getOrderPartyAddressAtIndex } from "@/lib/orders/types";

type CustomerContactSummaryProps = {
  customer: Customer;
  /** When set, shows this address instead of the customer's primary address. */
  addressIndex?: number;
};

export function CustomerContactSummary({ customer, addressIndex }: CustomerContactSummaryProps) {
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

  const lines = [phoneLine, ...addressLines].filter((line) => line.trim());

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm font-medium text-foreground">{customer.name}</p>
      {lines.length > 0 ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {lines.map((line, index) => (
            <p key={index} className="break-words">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
