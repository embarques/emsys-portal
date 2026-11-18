"use client";

import { useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";

import { AddressActionRow } from "@/components/addresses/address-action-row";
import { TableStreetAddress } from "@/components/addresses/table-street-address";
import { CustomerUnverifiedAddressAction } from "@/components/customers/customer-unverified-address-action";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

import { useCustomer } from "@/lib/customers/hooks/use-customers";
import type { Customer } from "@/lib/customers/types";
import {
  getAddressLabelKey,
  ADDRESS_TEXT_WRAP_CLASSNAME,
  getPrimaryAddress,
  orderAddressesForDisplay,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CustomerAddressesSheetProps = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerAddressesSheet({
  customer,
  open,
  onOpenChange,
}: CustomerAddressesSheetProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { openFormTab } = useWorkspaceTabs();
  const canUpdateCustomers = hasPermission(
    PERMISSIONS.clientsUpdate.name,
    PERMISSIONS.clientsUpdate.resourceType,
  );
  const detailQuery = useCustomer(customer?.id ?? null, open);

  const resolvedCustomer = detailQuery.data ?? customer;

  function openAddAddress() {
    if (!customer?.id || !canUpdateCustomers) return;
    onOpenChange(false);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: customer.id,
      customerFormIntent: "address",
      label: t("customers.actions.editNamed", { name: customer.name }),
    });
  }

  if (!customer) return null;

  const phone = getPrimaryPhoneDisplayNumber(resolvedCustomer?.phones ?? customer.phones);
  const addresses = resolvedCustomer ? orderAddressesForDisplay(resolvedCustomer) : [];
  const addressCount = resolvedCustomer
    ? resolveCustomerAddressCount(resolvedCustomer)
    : resolveCustomerAddressCount(customer);
  const countLabel =
    addressCount === 1
      ? t("customers.addresses.countBadgeOne")
      : t("customers.addresses.countBadge", { count: addressCount });

  return (
    <>
      <RecordViewSheet open={open} onOpenChange={onOpenChange}>
        <RecordViewSheetContent>
          <RecordViewSheetHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>{resolvedCustomer?.name ?? customer.name}</span>
                {addressCount > 0 ? (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {countLabel}
                  </Badge>
                ) : null}
              </span>
            }
            description={phone || t("customers.addresses.sheetTitle")}
          />

          <RecordViewSheetBody>
            <RecordViewSheetSection title={t("customers.view.addresses")} icon={MapPin}>
              {detailQuery.isFetching && addresses.length <= 1 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("customers.addresses.loadingAddresses")}
                </div>
              ) : null}

              {!detailQuery.isFetching && addresses.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t("common.empty.dash")}</p>
              ) : null}

              {addresses.map((address, index) => {
                const label = t(getAddressLabelKey(address, index));

                return (
                  <AddressActionRow
                    key={address.id ?? `${getAddressLabelKey(address, index)}-${index}`}
                    label={label}
                    address={address}
                    isPrimary={address.isPrimary}
                    labelAction={resolvedCustomer ? (
                      <CustomerUnverifiedAddressAction
                        customer={resolvedCustomer}
                        address={address}
                        label={label}
                        onBeforeEdit={() => onOpenChange(false)}
                      />
                    ) : null}
                  />
                );
              })}
            </RecordViewSheetSection>
          </RecordViewSheetBody>

          {canUpdateCustomers ? (
            <div className="shrink-0 border-t border-border bg-card px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={openAddAddress}
              >
                <Plus className="size-4" />
                {t("customers.addresses.addAddress")}
              </Button>
            </div>
          ) : null}
        </RecordViewSheetContent>
      </RecordViewSheet>

    </>
  );
}

type CustomerTableAddressCellProps = {
  customer: Customer;
  className?: string;
};

export function CustomerTableAddressCell({ customer, className }: CustomerTableAddressCellProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const detailQuery = useCustomer(customer.id, true);
  const resolvedCustomer = detailQuery.data ?? customer;
  const total = resolveCustomerAddressCount(resolvedCustomer);
  const primary = getPrimaryAddress(resolvedCustomer);
  // Table already has City / State / Zip columns — Address is street only.

  function openSheet(event: React.MouseEvent) {
    event.stopPropagation();
    setSheetOpen(true);
  }

  return (
    <>
      <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
        <TableStreetAddress
          address={primary}
          action={
            primary ? (
              <CustomerUnverifiedAddressAction
                customer={resolvedCustomer}
                address={primary}
                label={t(getAddressLabelKey(primary, 0))}
              />
            ) : null
          }
        />
        {detailQuery.isFetching && total <= 1 ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{t("customers.addresses.loadingAddresses")}</p>
        ) : null}
        {!detailQuery.isFetching && total > 1 ? (
          <button
            type="button"
            aria-label={t("customers.addresses.viewMoreAria")}
            className="mt-0.5 text-left text-xs font-medium text-primary hover:underline"
            onClick={openSheet}
          >
            {t("customers.addresses.viewMore")}
          </button>
        ) : null}
      </div>

      <CustomerAddressesSheet customer={resolvedCustomer} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
