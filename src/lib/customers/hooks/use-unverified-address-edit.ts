"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { isCustomerSenderType } from "@/lib/customers/customer-type";
import {
  coreAddressHasContent,
  coreAddressRequiresVerification,
  isAddressVerified,
  type Customer,
  type CustomerCoreAddress,
} from "@/lib/customers/types";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

export function useUnverifiedAddressEdit(customer: Customer, address: CustomerCoreAddress) {
  const { hasPermission } = useAuth();
  const { openFormTab } = useWorkspaceTabs();
  const { t } = useTranslation();
  const isUnverified = isCustomerSenderType(customer.customerType)
    && coreAddressRequiresVerification(address) && !isAddressVerified(address);
  // The form expects an index among non-empty addresses in API order, not display order.
  const focusAddressIndex = customer.addresses.filter(coreAddressHasContent).findIndex(
    (entry) => entry === address || Boolean(address.id && entry.id === address.id),
  );
  const canEdit = isUnverified && focusAddressIndex >= 0 && hasPermission(
    PERMISSIONS.clientsUpdate.name,
    PERMISSIONS.clientsUpdate.resourceType,
  );

  function editAddress(beforeEdit?: () => void) {
    if (!canEdit) return;
    beforeEdit?.();
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: customer.id,
      focusAddressIndex,
      label: t("customers.actions.editNamed", { name: customer.name }),
    });
  }

  return { isUnverified, canEdit, editAddress };
}
