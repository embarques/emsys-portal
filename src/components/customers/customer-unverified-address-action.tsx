"use client";

import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnverifiedAddressEdit } from "@/lib/customers/hooks/use-unverified-address-edit";
import type { Customer, CustomerCoreAddress } from "@/lib/customers/types";
import { useTranslation } from "@/lib/i18n";

type CustomerUnverifiedAddressActionProps = {
  customer: Customer;
  address: CustomerCoreAddress;
  label: string;
  onBeforeEdit?: () => void;
};

export function CustomerUnverifiedAddressAction({
  customer, address, label, onBeforeEdit,
}: CustomerUnverifiedAddressActionProps) {
  const { t } = useTranslation();
  const { isUnverified, canEdit, editAddress } = useUnverifiedAddressEdit(customer, address);
  if (!isUnverified) return null;

  const status = t("customers.address.unverified");
  const action = t("customers.address.editUnverifiedAria", { label, name: customer.name });
  const icon = <ShieldAlert className="size-4" aria-hidden="true" />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
            aria-label={action}
            onClick={(event) => { event.stopPropagation(); editAddress(onBeforeEdit); }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {icon}
          </Button>
        ) : (
          <span role="img" aria-label={status} className="inline-flex size-7 shrink-0 items-center justify-center text-amber-700 dark:text-amber-300">
            {icon}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{canEdit ? action : status}</TooltipContent>
    </Tooltip>
  );
}
