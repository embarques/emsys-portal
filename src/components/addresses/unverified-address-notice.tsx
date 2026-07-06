"use client";

import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  customerHasUnverifiedPrimaryAddress,
  type Customer,
} from "@/lib/customers/types";
import { cn } from "@/lib/utils";

type UnverifiedAddressNoticeProps = {
  customer: Pick<Customer, "addresses" | "customerType">;
  /** Opens the customer edit flow so the address can be verified via Google. */
  onUpdateAddress: () => void;
  className?: string;
};

/**
 * Inline prompt shown when a selected client's primary address has not been
 * verified against Google. Used across invoice, order, and customer flows.
 */
export function UnverifiedAddressNotice({
  customer,
  onUpdateAddress,
  className,
}: UnverifiedAddressNoticeProps) {
  if (!customerHasUnverifiedPrimaryAddress(customer)) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2",
        "text-sm text-amber-800 dark:text-amber-200",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">This client&apos;s address isn&apos;t verified.</p>
        <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
          Update it with a Google-suggested address to confirm the location.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-amber-500/50 bg-transparent text-amber-800 hover:bg-amber-500/15 dark:text-amber-200"
        onClick={onUpdateAddress}
      >
        Update address
      </Button>
    </div>
  );
}
