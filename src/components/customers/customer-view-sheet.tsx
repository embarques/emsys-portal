"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{customer.name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{truncateCustomerId(customer.id)}</span>
            <Badge className={getCustomerBranchBadgeClass(customer)}>{formatCustomerBranchLabel(customer)}</Badge>
            <Badge className={getCustomerActiveBadgeClass(customer.active)}>
              {getCustomerActiveLabel(customer.active)}
            </Badge>
            {clientType ? (
              <Badge className={getClientTypeBadgeClass(clientType)}>{getClientTypeLabel(clientType)}</Badge>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2 px-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(customer)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(customer)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="id" value={customer.id} />
            <DetailRow label="oldID" value={customer.oldID > 0 ? String(customer.oldID) : "—"} />
            <DetailRow label="name" value={customer.name} />
            <DetailRow label="active" value={getCustomerActiveLabel(customer.active)} />
            <DetailRow label="customerType" value={getCustomerTypeLabel(customer)} />
            <DetailRow label="createdByID" value={customer.createdByID != null ? String(customer.createdByID) : "—"} />
            <DetailRow label="createdAt" value={customer.createdAt ? formatAuditDate(customer.createdAt) : "—"} />
            <DetailRow label="updatedAt" value={customer.updatedAt ? formatAuditDate(customer.updatedAt) : "—"} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="branch.id" value={String(customer.branch.id)} />
            <DetailRow label="branch.code" value={customer.branch.code || "—"} />
            <DetailRow label="branch.name" value={customer.branch.name || "—"} />
            <DetailRow label="branch.phone1" value={customer.branch.phone1 || "—"} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="phone1" value={customer.phone1 || "—"} />
            <DetailRow label="phone2" value={customer.phone2 || "—"} />
            <DetailRow label="phones" value={formatPhoneList(customer)} />
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="address.address1" value={customer.address.address1 || "—"} />
            <DetailRow label="address.address2" value={customer.address.address2 || "—"} />
            <DetailRow label="address.apartment" value={customer.address.apartment || "—"} />
            <DetailRow label="address.city" value={customer.address.city || "—"} />
            <DetailRow label="address.state" value={customer.address.state || "—"} />
            <DetailRow label="address.zipcode" value={customer.address.zipcode || "—"} />
            <DetailRow label="address.country" value={customer.address.country || "—"} />
            <DetailRow label="address" value={formatCoreAddressLine(customer.address)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
