"use client";

import { Info, MapPin, Phone as PhoneIcon, User, Wallet } from "lucide-react";

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
import { AddressActionRow } from "@/components/addresses/address-action-row";
import {
  formatRecordPhoneTypeLabel,
  getOrderedRecordPhones,
} from "@/lib/phones/phones";
import { formatAccountBalance, getClientTypeBadgeClass } from "@/lib/customers/display";
import { isCustomerReceiverType } from "@/lib/customers/customer-type";
import { getCustomerClientType, coreAddressHasContent } from "@/lib/customers/types";
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

  if (!customer) return null;

  const clientType = getCustomerClientType(customer);
  const typeLabel = isCustomerReceiverType(customer.customerType)
    ? t("customers.types.receiver")
    : t("customers.types.sender");
  const addresses = customer.addresses.filter(coreAddressHasContent);
  const phones = getOrderedRecordPhones(customer.phones);
  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{customer.name}</span>
              {clientType ? (
                <Badge className={getClientTypeBadgeClass(clientType)}>{typeLabel}</Badge>
              ) : null}
            </span>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("customers.view.general")} icon={User}>
            <RecordViewSheetDetailRow label={t("customers.view.email")} value={customer.email || dash} />
            <RecordViewSheetDetailRow
              label={t("customers.view.idNumber")}
              value={customer.IDNumber || dash}
            />
            <RecordViewSheetDetailRow label={t("customers.view.notes")} value={customer.notes || dash} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("customers.view.phones")} icon={PhoneIcon}>
            {phones.length === 0 ? (
              <RecordViewSheetDetailRow label={t("customers.view.phones")} value={dash} />
            ) : (
              phones.map((phone, index) => (
                <PhoneActionRow
                  key={`phone-${index}`}
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

          {addresses.length > 0 ? (
            <RecordViewSheetSection title={t("customers.view.addresses")} icon={MapPin}>
              {addresses.map((address, index) => (
                <AddressActionRow
                  key={index}
                  label={
                    address.isPrimary
                      ? t("customers.form.address.primary")
                      : t("customers.form.address.additional", { index })
                  }
                  address={address}
                />
              ))}
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("customers.view.account")} icon={Wallet}>
            <RecordViewSheetDetailRow
              label={t("customers.view.accountBalance")}
              value={formatAccountBalance(customer.accountBalance)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("customers.view.system")} icon={Info}>
            <RecordViewSheetDetailRow label={t("customers.view.customerId")} value={customer.id} />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchName")}
              value={customer.branch.name || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchCode")}
              value={customer.branch.code || dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.branchId")}
              value={String(customer.branch.id)}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.createdBy")}
              value={customer.createdByID != null ? String(customer.createdByID) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.createdAt")}
              value={customer.createdAt ? formatAuditDate(customer.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("customers.view.updatedAt")}
              value={customer.updatedAt ? formatAuditDate(customer.updatedAt) : dash}
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
