"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatRouteAssignmentDate,
  formatRouteAssignmentTimestamp,
  getEmployeeGroupLabel,
  getTruckName,
  truncateRouteAssignmentId,
} from "@/lib/route-assignments/display";
import { formatAuditDate } from "@/lib/audit/display";
import type { RouteAssignment } from "@/lib/route-assignments/types";

type RouteAssignmentViewSheetProps = {
  assignment: RouteAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (assignment: RouteAssignment) => void;
  onDelete: (assignment: RouteAssignment) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function RouteAssignmentViewSheet({
  assignment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: RouteAssignmentViewSheetProps) {
  if (!assignment) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{assignment.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{assignment.routeAssignmentId}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Assignment ID" value={truncateRouteAssignmentId(assignment.routeAssignmentId)} />
            <DetailRow label="Assignment date" value={formatRouteAssignmentDate(assignment.date)} />
            <DetailRow label="Truck" value={getTruckName(assignment.truckId)} />
            <DetailRow label="Employee group" value={getEmployeeGroupLabel(assignment.employeeGroupId)} />
            <DetailRow label="Date created" value={formatRouteAssignmentTimestamp(assignment.createdAt)} />
            <DetailRow label="User created" value={assignment.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(assignment.updatedAt)} />
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(assignment)}>
              <Pencil className="h-4 w-4" />
              Edit assignment
            </Button>
            <Button variant="destructive" onClick={() => onDelete(assignment)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
