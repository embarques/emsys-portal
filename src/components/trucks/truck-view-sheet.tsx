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
  getBranchBadgeClass,
  getBranchLabel,
  getFuelTypeBadgeClass,
  getFuelTypeLabel,
} from "@/lib/trucks/display";
import type { Truck } from "@/lib/trucks/types";

type TruckViewSheetProps = {
  truck: Truck | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (truck: Truck) => void;
  onDelete: (truck: Truck) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function TruckViewSheet({ truck, open, onOpenChange, onEdit, onDelete }: TruckViewSheetProps) {
  if (!truck) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{truck.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{truck.truckId}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className={getFuelTypeBadgeClass(truck.fuelType)}>{getFuelTypeLabel(truck.fuelType)}</Badge>
            <Badge className={getBranchBadgeClass(truck.branch)}>{getBranchLabel(truck.branch)}</Badge>
          </div>

          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Truck ID" value={truck.truckId} />
            <DetailRow label="VIN" value={truck.vin} />
            <DetailRow label="Year" value={truck.year} />
            <DetailRow label="Fuel type" value={getFuelTypeLabel(truck.fuelType)} />
            <DetailRow label="Branch" value={getBranchLabel(truck.branch)} />
            <DetailRow label="Date created" value={formatAuditDate(truck.createdAt)} />
            <DetailRow label="User created" value={truck.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(truck.updatedAt)} />
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(truck)}>
              <Pencil className="h-4 w-4" />
              Edit truck
            </Button>
            <Button variant="destructive" onClick={() => onDelete(truck)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
