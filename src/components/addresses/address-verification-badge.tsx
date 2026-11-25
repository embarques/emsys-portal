"use client";

import {
  coreAddressRequiresVerification,
  isAddressVerified,
  type CustomerCoreAddress,
} from "@/lib/customers/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AddressVerificationBadgeProps = {
  address: CustomerCoreAddress;
  className?: string;
};

export function AddressVerificationBadge({ address, className }: AddressVerificationBadgeProps) {
  const { t } = useTranslation();
  if (!coreAddressRequiresVerification(address)) return null;

  const verified = isAddressVerified(address);

  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-center text-xs font-medium leading-none",
        verified
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      {verified ? t("customers.address.verified") : t("customers.address.unverified")}
    </span>
  );
}
