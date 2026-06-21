"use client";

import { BadgeCheck, ShieldAlert } from "lucide-react";

import {
  coreAddressRequiresVerification,
  isAddressVerified,
  type CustomerCoreAddress,
} from "@/lib/customers/types";
import { cn } from "@/lib/utils";

type AddressVerificationBadgeProps = {
  address: CustomerCoreAddress;
  className?: string;
};

export function AddressVerificationBadge({ address, className }: AddressVerificationBadgeProps) {
  if (!coreAddressRequiresVerification(address)) return null;

  const verified = isAddressVerified(address);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        verified
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      {verified ? <BadgeCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
      {verified ? "Verified" : "Unverified"}
    </span>
  );
}
