"use client";

import { AssignRouteCrewDialog } from "@/components/pickup-delivery-routes/assign-route-crew-dialog";
import { todayDateInputValue } from "@/lib/route-manager/types";

type AssignAppointmentRouteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickupIds: number[];
  defaultDate?: string;
};

export function sharedAppointmentDate(dates: Array<string | undefined | null>): string {
  const unique = [
    ...new Set(
      dates
        .map((value) => value?.trim().slice(0, 10) ?? "")
        .filter(Boolean),
    ),
  ];
  return unique.length === 1 ? unique[0] : todayDateInputValue();
}

export function AssignAppointmentRouteDialog({
  open,
  onOpenChange,
  pickupIds,
  defaultDate,
}: AssignAppointmentRouteDialogProps) {
  return (
    <AssignRouteCrewDialog
      open={open}
      onOpenChange={onOpenChange}
      routeType="pickup"
      pickupIds={pickupIds}
      defaultDate={defaultDate}
    />
  );
}
