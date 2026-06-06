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
  formatAddressLine,
  getClientTypeBadgeClass,
  getClientTypeLabel,
} from "@/lib/customers/display";
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

export function CustomerViewSheet({ customer, open, onOpenChange, onEdit, onDelete }: CustomerViewSheetProps) {
  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{customer.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{customer.clientId}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="mb-4">
            <Badge className={getClientTypeBadgeClass(customer.clientType)}>{getClientTypeLabel(customer.clientType)}</Badge>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Document ID" value={customer.documentId ?? "—"} />
            <DetailRow label="Email" value={customer.email ?? "—"} />
            <DetailRow label="Date created" value={formatAuditDate(customer.createdAt)} />
            <DetailRow label="User created" value={customer.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(customer.updatedAt)} />
          </div>

          <div className="mt-4 rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phone numbers ({customer.phones.length})
            </p>
            {customer.phones.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {customer.phones.map((phone) => (
                  <li key={phone.id} className="text-sm">
                    {phone.label ? <span className="text-muted-foreground">{phone.label}: </span> : null}
                    <span className="font-medium">{phone.number}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No phone numbers on file.</p>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Addresses ({customer.addresses.length})
            </p>
            {customer.addresses.length > 0 ? (
              customer.addresses.map((address, index) => (
                <div key={address.id} className="rounded-xl border bg-muted/20 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm font-medium">Address {index + 1}</p>
                    {address.isPrimary ? (
                      <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed">{formatAddressLine(address)}</p>
                  {address.crossStreet ? (
                    <p className="mt-1 text-xs text-muted-foreground">Cross street: {address.crossStreet}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No addresses on file.</p>
            )}
          </div>

          {customer.notes ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-2 text-sm leading-relaxed">{customer.notes}</p>
            </div>
          ) : null}

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(customer)}>
              <Pencil className="h-4 w-4" />
              Edit client
            </Button>
            <Button variant="destructive" onClick={() => onDelete(customer)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
