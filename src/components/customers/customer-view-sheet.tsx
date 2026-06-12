"use client";

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
import {
  formatRecordPhoneTypeLabel,
  getOrderedRecordPhones,
} from "@/lib/phones/phones";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import {
  formatAccountBalance,
  formatCoreAddressLine,
  formatCustomerBranchLabel,
  getClientTypeBadgeClass,
  getClientTypeLabel,
  getCustomerBranchBadgeClass,
  getCustomerTypeLabel,
  truncateCustomerId,
} from "@/lib/customers/display";
import { getCustomerClientType } from "@/lib/customers/types";
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
  const addresses =
    customer.addresses.length > 0 ? customer.addresses : customer.address.address1 ? [customer.address] : [];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={customer.name}
          description={<span className="font-mono text-xs">{truncateCustomerId(customer.id)}</span>}
          meta={
            <>
              <Badge className={getCustomerBranchBadgeClass(customer)}>{formatCustomerBranchLabel(customer)}</Badge>
              {clientType ? (
                <Badge className={getClientTypeBadgeClass(clientType)}>{getClientTypeLabel(clientType)}</Badge>
              ) : null}
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="General">
            <RecordViewSheetDetailRow label="Name" value={customer.name} />
            <RecordViewSheetDetailRow label="Customer type" value={getCustomerTypeLabel(customer)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="System information">
            <RecordViewSheetDetailRow label="Customer ID" value={customer.id} />
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

          <RecordViewSheetSection title="Branch">
            <RecordViewSheetDetailRow label="Branch ID" value={String(customer.branch.id)} />
            <RecordViewSheetDetailRow label="Branch code" value={customer.branch.code || "—"} />
            <RecordViewSheetDetailRow label="Branch name" value={customer.branch.name || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            {getOrderedRecordPhones(customer.phones).length === 0 ? (
              <RecordViewSheetDetailRow label="Phones" value="—" />
            ) : (
              getOrderedRecordPhones(customer.phones).map((phone, index) => (
                <RecordViewSheetDetailRow
                  key={`phone-${index}`}
                  label={
                    phone.isPrimary
                      ? `${formatRecordPhoneTypeLabel(phone.type)} (primary)`
                      : formatRecordPhoneTypeLabel(phone.type)
                  }
                  value={formatPhoneForDisplay(phone.number)}
                />
              ))
            )}
            <RecordViewSheetDetailRow label="Email" value={customer.email || "—"} />
            <RecordViewSheetDetailRow label="ID number" value={customer.IDNumber || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Account">
            <RecordViewSheetDetailRow
              label="Account balance"
              value={formatAccountBalance(customer.accountBalance)}
            />
            <RecordViewSheetDetailRow label="Notes" value={customer.notes || "—"} />
          </RecordViewSheetSection>

          {addresses.map((address, index) => (
            <RecordViewSheetSection
              key={index}
              title={index === 0 ? "Primary address" : `Additional address ${index}`}
            >
              <RecordViewSheetDetailRow label="Address 1" value={address.address1 || "—"} />
              <RecordViewSheetDetailRow label="Address 2" value={address.address2 || "—"} />
              <RecordViewSheetDetailRow label="Apartment" value={address.apartment || "—"} />
              <RecordViewSheetDetailRow label="City" value={address.city || "—"} />
              <RecordViewSheetDetailRow label="State" value={address.state || "—"} />
              <RecordViewSheetDetailRow label="Zipcode" value={address.zipcode || "—"} />
              <RecordViewSheetDetailRow label="Country" value={address.country || "—"} />
              <RecordViewSheetDetailRow label="Full address" value={formatCoreAddressLine(address)} />
            </RecordViewSheetSection>
          ))}
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
