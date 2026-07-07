"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPhoneDisplayAtIndex } from "@/lib/phones/phones";
import type { Customer } from "@/lib/customers/types";
import {
  formatAddress,
  ADDRESS_TEXT_WRAP_CLASSNAME,
  getAddressLabelKey,
  orderAddressesForDisplay,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";

export function CustomerContactSummary({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const phone1 = getPhoneDisplayAtIndex(customer.phones, 0);
  const phone2 = getPhoneDisplayAtIndex(customer.phones, 1);
  const phoneLine = [phone1, phone2].filter((value) => value.trim()).join("  ·  ");
  const addresses = orderAddressesForDisplay(customer);
  const addressCount = resolveCustomerAddressCount(customer);

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{customer.name}</p>
        {addressCount > 1 ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {t("customers.addresses.countBadge", { count: addressCount })}
          </Badge>
        ) : null}
      </div>

      {phoneLine ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{phoneLine}</p> : null}

      {addresses.length > 0 ? (
        <div className="mt-2 space-y-2">
          {addresses.map((address, index) => (
            <div key={address.id ?? `${customer.id}-address-${index}`} className="text-xs text-muted-foreground">
              {addresses.length > 1 ? (
                <Badge variant="outline" className="mb-1 h-5 px-1.5 text-[10px]">
                  {t(getAddressLabelKey(address, index))}
                </Badge>
              ) : null}
              <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "text-foreground/90")}>
                {formatAddress(address, "full")}
              </p>
              {address.phone?.trim() ? <p className="mt-0.5">{address.phone.trim()}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
