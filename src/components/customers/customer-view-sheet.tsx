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
};

export function CustomerViewSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: CustomerViewSheetProps) {
  if (!customer) return null;

  const clientType = getCustomerClientType(customer);

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
            <RecordViewSheetDetailRow label="Branch phone" value={customer.branch.phone1 || "—"} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Phones">
            <RecordViewSheetDetailRow label="Phone 1" value={customer.phone1 || "—"} />
            <RecordViewSheetDetailRow label="Phone 2" value={customer.phone2 || "—"} />
            <RecordViewSheetDetailRow label="All phones" value={formatPhoneList(customer)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Address">
            <RecordViewSheetDetailRow label="Address 1" value={customer.address.address1 || "—"} />
            <RecordViewSheetDetailRow label="Address 2" value={customer.address.address2 || "—"} />
            <RecordViewSheetDetailRow label="Apartment" value={customer.address.apartment || "—"} />
            <RecordViewSheetDetailRow label="City" value={customer.address.city || "—"} />
            <RecordViewSheetDetailRow label="State" value={customer.address.state || "—"} />
            <RecordViewSheetDetailRow label="Zipcode" value={customer.address.zipcode || "—"} />
            <RecordViewSheetDetailRow label="Country" value={customer.address.country || "—"} />
            <RecordViewSheetDetailRow label="Full address" value={formatCoreAddressLine(customer.address)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel="Edit customer"
          onEdit={() => onEdit(customer)}
          onDelete={() => onDelete(customer)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
