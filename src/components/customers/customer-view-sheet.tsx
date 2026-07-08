"use client";

import { Info, Loader2, Phone as PhoneIcon, User, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { formatAuditDate } from "@/lib/audit/display";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { FlippableCustomerAddresses } from "@/components/customers/flippable-customer-addresses";
import {
  formatRecordPhoneTypeLabel,
  getOrderedRecordPhones,
} from "@/lib/phones/phones";
import { formatAccountBalance, getClientTypeBadgeClass } from "@/lib/customers/display";
import { isCustomerReceiverType } from "@/lib/customers/customer-type";
import { useCustomer } from "@/lib/customers/hooks/use-customers";
import { getCustomerClientType } from "@/lib/customers/types";
import {
  getAllAddresses,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
import { useTranslation } from "@/lib/i18n";
import type { Customer } from "@/lib/customers/types";

type CustomerViewSheetProps = {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function CustomerViewSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: CustomerViewSheetProps) {
  const { t } = useTranslation();
  const detailQuery = useCustomer(customer?.id ?? null, open && Boolean(customer));
  const resolvedCustomer = detailQuery.data ?? customer;
  const dash = t("common.empty.dash");

  if (!customer || !resolvedCustomer) return null;

  const clientType = getCustomerClientType(resolvedCustomer);
  const typeLabel = isCustomerReceiverType(resolvedCustomer.customerType)
    ? t("customers.types.receiver")
    : t("customers.types.sender");
  const hasAddresses =
    getAllAddresses(resolvedCustomer).length > 0 ||
    resolveCustomerAddressCount(resolvedCustomer) > 0;
  const phones = getOrderedRecordPhones(resolvedCustomer.phones);
  const isLoadingPhones = detailQuery.isFetching && phones.length === 0;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{resolvedCustomer.name}</span>
              {clientType ? (
                <Badge className={getClientTypeBadgeClass(clientType)}>{typeLabel}</Badge>
              ) : null}
            </span>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("customers.view.general")} icon={User}>
            <RecordViewSheetDetailRow
              label={t("customers.view.email")}
              value={resolvedCustomer.email || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.idNumber")}
              value={resolvedCustomer.IDNumber || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.notes")}
              value={resolvedCustomer.notes || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("customers.view.phones")} icon={PhoneIcon}>
            {isLoadingPhones ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : phones.length === 0 ? (
              <RecordViewSheetDetailRow label={t("customers.view.phones")} value={dash} />
            ) : (
              phones.map((phone, index) => (
                <PhoneActionRow
                  key={`${phone.number}-${phone.type}-${index}`}
                  label={
                    phone.isPrimary
                      ? t("customers.view.primaryPhone", {
                          type: formatRecordPhoneTypeLabel(phone.type),
                        })
                      : formatRecordPhoneTypeLabel(phone.type)
                  }
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                />
              ))
            )}
          </RecordViewSheetSection>

          {hasAddresses || detailQuery.isFetching ? (
            <FlippableCustomerAddresses
              customer={resolvedCustomer}
              isLoading={detailQuery.isFetching}
            />
          ) : null}

          <RecordViewSheetSection title={t("customers.view.account")} icon={Wallet}>
            <RecordViewSheetDetailRow
              label={t("customers.view.accountBalance")}
              value={formatAccountBalance(resolvedCustomer.accountBalance)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("customers.view.system")} icon={Info}>
            <RecordViewSheetDetailRow label={t("customers.view.customerId")} value={resolvedCustomer.id} />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchName")}
              value={resolvedCustomer.branch.name || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchCode")}
              value={resolvedCustomer.branch.code || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchId")}
              value={String(resolvedCustomer.branch.id)}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.createdBy")}
              value={resolvedCustomer.createdByID != null ? String(resolvedCustomer.createdByID) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.createdAt")}
              value={resolvedCustomer.createdAt ? formatAuditDate(resolvedCustomer.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.updatedAt")}
              value={resolvedCustomer.updatedAt ? formatAuditDate(resolvedCustomer.updatedAt) : dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("customers.view.edit")}
          onEdit={canEdit ? () => onEdit(customer) : undefined}
          onDelete={canDelete ? () => onDelete(customer) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
