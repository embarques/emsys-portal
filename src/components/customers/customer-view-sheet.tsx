"use client";

import { Info, Phone as PhoneIcon, User, Wallet } from "lucide-react";

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
import {
  formatAccountBalance,
  getClientTypeBadgeClass,
  getClientTypeLabel,
} from "@/lib/customers/display";
import { getCustomerClientType } from "@/lib/customers/types";
import {
  getAllAddresses,
  resolveCustomerAddressCount,
} from "@/lib/customers/utils/address-utils";
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
  if (!customer) return null;

  const clientType = getCustomerClientType(customer);
  const phones = getOrderedRecordPhones(customer.phones);
  const hasAddresses =
    getAllAddresses(customer).length > 0 || resolveCustomerAddressCount(customer) > 0;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{customer.name}</span>
              {clientType ? (
                <Badge className={getClientTypeBadgeClass(clientType)}>{getClientTypeLabel(clientType)}</Badge>
              ) : null}
            </span>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="General" icon={User}>
            <RecordViewSheetDetailRow label="Email" value={customer.email || "—"} />
            <RecordViewSheetDetailRow label="ID number" value={customer.IDNumber || "—"} />
            <RecordViewSheetDetailRow label="Notes" value={customer.notes || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Phones" icon={PhoneIcon}>
            {phones.length === 0 ? (
              <RecordViewSheetDetailRow label="Phones" value="—" />
            ) : (
              phones.map((phone, index) => (
                <PhoneActionRow
                  key={`phone-${index}`}
                  label={
                    phone.isPrimary
                      ? `${formatRecordPhoneTypeLabel(phone.type)} (primary)`
                      : formatRecordPhoneTypeLabel(phone.type)
                  }
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                />
              ))
            )}
          </RecordViewSheetSection>

          {hasAddresses ? <FlippableCustomerAddresses customer={customer} /> : null}

          <RecordViewSheetSection title="Account" icon={Wallet}>
            <RecordViewSheetDetailRow
              label="Account balance"
              value={formatAccountBalance(customer.accountBalance)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="System information" icon={Info}>
            <RecordViewSheetDetailRow label="Customer ID" value={customer.id} />
            <RecordViewSheetDetailRow label="Branch name" value={customer.branch.name || "—"} />
            <RecordViewSheetDetailRow label="Branch code" value={customer.branch.code || "—"} />
            <RecordViewSheetDetailRow label="Branch ID" value={String(customer.branch.id)} />
            <RecordViewSheetDetailRow
              label="Created by"
              value={customer.createdByID != null ? String(customer.createdByID) : "—"}
            />
            <RecordViewSheetDetailRow
              label="Created at"
              value={customer.createdAt ? formatAuditDate(customer.createdAt) : "—"}
            />
            <RecordViewSheetDetailRow
              label="Updated at"
              value={customer.updatedAt ? formatAuditDate(customer.updatedAt) : "—"}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit customer"
          onEdit={canEdit ? () => onEdit(customer) : undefined}
          onDelete={canDelete ? () => onDelete(customer) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
