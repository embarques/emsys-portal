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
  formatContainerCost,
  formatContainerDate,
  truncateContainerId,
} from "@/lib/containers/display";
import type { ContainerRecord } from "@/lib/containers/types";

type ContainerViewSheetProps = {
  container: ContainerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (container: ContainerRecord) => void;
  onDelete: (container: ContainerRecord) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function ContainerViewSheet({
  container,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ContainerViewSheetProps) {
  if (!container) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{container.containerCode}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{container.containerNumber}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline">{container.transportCompany || "No carrier"}</Badge>
            <Badge variant="secondary">{formatContainerCost(container.cost)}</Badge>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Container ID" value={truncateContainerId(container.containerId)} />
            <DetailRow label="Container" value={container.containerCode} />
            <DetailRow label="Container number" value={container.containerNumber} />
            <DetailRow label="Booking number" value={container.bookingNumber} />
            <DetailRow label="Seal number" value={container.sealNumber || "—"} />
            <DetailRow label="Broker" value={container.broker || "—"} />
            <DetailRow label="Transport company" value={container.transportCompany || "—"} />
            <DetailRow label="Cost" value={formatContainerCost(container.cost)} />
            <DetailRow label="Departure date" value={formatContainerDate(container.departureDate)} />
            <DetailRow label="Arrival date" value={formatContainerDate(container.arrivalDate)} />
            <DetailRow label="Date created" value={formatAuditDate(container.createdAt)} />
            <DetailRow label="User created" value={container.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(container.updatedAt)} />
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(container)}>
              <Pencil className="h-4 w-4" />
              Edit container
            </Button>
            <Button variant="destructive" onClick={() => onDelete(container)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
