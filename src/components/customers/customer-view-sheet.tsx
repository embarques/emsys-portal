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
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import {
  formatAccountBalance,
  formatCoreAddressLine,
  formatCustomerBranchLabel,
  formatPhoneList,
  getClientTypeBadgeClass,
  getClientTypeLabel,
  getCustomerActiveBadgeClass,
  getCustomerActiveLabel,
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
  canDelete?: boolean;
};

export function CustomerViewSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
  onDelete,
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
              <Badge className={getCustomerActiveBadgeClass(customer.active)}>
                {getCustomerActiveLabel(customer.active)}
              </Badge>
              {clientType ? (
                <Badge className={getClientTypeBadgeClass(clientType)}>{getClientTypeLabel(clientType)}</Badge>
              ) : null}
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="General">
            <RecordViewSheetDetailRow label="ID" value={customer.id} />
            <RecordViewSheetDetailRow label="Old ID" value={customer.oldID > 0 ? String(customer.oldID) : "—"} />
            <RecordViewSheetDetailRow label="Name" value={customer.name} />
            <RecordViewSheetDetailRow label="Active" value={getCustomerActiveLabel(customer.active)} />
            <RecordViewSheetDetailRow label="Customer type" value={getCustomerTypeLabel(customer)} />
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
            <RecordViewSheetDetailRow
              label="Branch phone"
              value={formatPhoneDisplayOrDash(customer.branch.phone1)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Contact">
            <RecordViewSheetDetailRow label="Phone 1" value={formatPhoneDisplayOrDash(customer.phone1)} />
            <RecordViewSheetDetailRow label="Phone 2" value={formatPhoneDisplayOrDash(customer.phone2)} />
            <RecordViewSheetDetailRow label="All phones" value={formatPhoneList(customer)} />
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
          onEdit={() => onEdit(customer)}
          onDelete={canDelete ? () => onDelete(customer) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
