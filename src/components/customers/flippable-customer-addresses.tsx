"use client";

import { useEffect, useState, type ComponentType } from "react";
import { ArrowLeft, Info, Loader2, MapPin } from "lucide-react";

import { AddressActionRow } from "@/components/addresses/address-action-row";
import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCustomer } from "@/lib/customers/hooks/use-customers";
import type { Customer } from "@/lib/customers/types";
import {
  formatAddressLine,
  getAddressLabelKey,
  ADDRESS_TEXT_WRAP_CLASSNAME,
  getAllAddresses,
  getPrimaryAddress,
  orderAddressesForDisplay,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FlippableCustomerAddressesProps = {
  customer: Customer;
};

type FlipActionProps = {
  label: string;
  onClick: () => void;
  tabIndex: number;
  icon: ComponentType<{ className?: string }>;
};

function FlipAction({ label, onClick, tabIndex, icon: Icon }: FlipActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="size-7"
          onClick={onClick}
          size="icon"
          tabIndex={tabIndex}
          type="button"
          variant="outline"
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function FlippableCustomerAddresses({ customer }: FlippableCustomerAddressesProps) {
  const { t } = useTranslation();
  const detailQuery = useCustomer(customer.id, true);
  const resolvedCustomer = detailQuery.data ?? customer;
  const addresses = getAllAddresses(resolvedCustomer);
  const primary = getPrimaryAddress(resolvedCustomer);
  const addressCount = resolveCustomerAddressCount(resolvedCustomer);
  const canFlip = addresses.length > 0;
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [customer.id]);

  if (!canFlip) {
    return null;
  }

  const orderedAddresses = orderAddressesForDisplay(resolvedCustomer);
  const displayPrimary = primary ?? addresses[0];

  return (
    <TooltipProvider delayDuration={300}>
      <RecordViewSheetSection
        title="Addresses"
        icon={MapPin}
        headerAction={
          showAll ? (
            <FlipAction
              icon={ArrowLeft}
              label={t("customers.addresses.backToPrimary")}
              onClick={() => setShowAll(false)}
              tabIndex={0}
            />
          ) : (
            <FlipAction
              icon={Info}
              label={t("customers.addresses.viewAllAddresses")}
              onClick={() => setShowAll(true)}
              tabIndex={0}
            />
          )
        }
      >
        <div className="[perspective:1000px]">
          <div
            className={cn(
              "relative w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
              showAll && "[transform:rotateY(180deg)]",
            )}
          >
            <div
              aria-hidden={showAll}
              className="relative min-h-[5.5rem] [backface-visibility:hidden]"
            >
              {detailQuery.isFetching && !displayPrimary ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("customers.addresses.loadingAddresses")}
                </div>
              ) : displayPrimary ? (
                <AddressActionRow
                  label={t("customers.addresses.labels.primary")}
                  address={displayPrimary}
                />
              ) : null}
            </div>

            <div
              aria-hidden={!showAll}
              className="absolute inset-0 flex min-h-full flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]"
            >
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-foreground">
                  {t("customers.addresses.allAddressesTitle", {
                    count: Math.max(addressCount, orderedAddresses.length),
                  })}
                </p>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">
                        {t("customers.addresses.tableLabel")}
                      </th>
                      <th className="pb-2 font-medium">{t("customers.addresses.tableAddress")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAddresses.map((address, index) => (
                      <tr
                        key={address.id ?? `${customer.id}-address-${index}`}
                        className="border-b border-border/60 last:border-b-0"
                      >
                        <td className="py-2 pr-3 align-top font-medium text-muted-foreground">
                          {t(getAddressLabelKey(address, index))}
                        </td>
                        <td className={cn("py-2 align-top text-foreground", ADDRESS_TEXT_WRAP_CLASSNAME)}>
                          {formatAddressLine(address, "full")}
                          {address.phone?.trim() ? (
                            <span className="mt-0.5 block text-muted-foreground">
                              {address.phone.trim()}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </RecordViewSheetSection>
    </TooltipProvider>
  );
}
