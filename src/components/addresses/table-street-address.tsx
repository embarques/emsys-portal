"use client";

import type { ReactNode } from "react";

import type { CustomerCoreAddress } from "@/lib/customers/types";
import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
import { cn } from "@/lib/utils";

type TableStreetAddressProps = {
  address?: CustomerCoreAddress | null;
  /** Shown when there is no address content at all. */
  emptyLabel?: string;
  /** Optional action rendered on the address1/apartment row (e.g. unverified badge). */
  action?: ReactNode;
  className?: string;
};

/**
 * Directory-table street address layout:
 * row 1 — address1 + apartment (+ optional action)
 * row 2 — address2 in muted text
 */
export function TableStreetAddress({
  address,
  emptyLabel = "—",
  action,
  className,
}: TableStreetAddressProps) {
  if (!address) {
    return <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug", className)}>{emptyLabel}</p>;
  }

  const address1 = address.address1?.trim() ?? "";
  const apartment = address.apartment?.trim() ?? "";
  const address2 = address.address2?.trim() ?? "";
  const primaryStreetLine = [address1, apartment].filter(Boolean).join(" ");
  const addressTitle = [primaryStreetLine, address2].filter(Boolean).join(", ") || emptyLabel;

  if (!primaryStreetLine && !address2) {
    return (
      <div className={cn("inline-flex max-w-full items-center gap-1.5", className)} title={emptyLabel}>
        <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")}>{emptyLabel}</p>
        {action}
      </div>
    );
  }

  return (
    <div className={cn("max-w-full", className)} title={addressTitle}>
      <div className="inline-flex max-w-full items-center gap-1.5">
        {primaryStreetLine ? (
          <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")}>{primaryStreetLine}</p>
        ) : null}
        {action}
      </div>
      {address2 ? (
        <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug text-muted-foreground")}>{address2}</p>
      ) : null}
    </div>
  );
}
