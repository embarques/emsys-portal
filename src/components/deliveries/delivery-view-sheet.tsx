"use client";

import { Car, Edit, PackagePlus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { AddDeliveryPackagesDialog } from "@/components/deliveries/add-delivery-packages-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatDeliveryDate,
  formatDeliveryId,
  groupDeliveryBarcodes,
} from "@/lib/deliveries/display";
import { useDeliveryBarcodes } from "@/lib/deliveries/hooks/use-deliveries";
import type { Delivery } from "@/lib/deliveries/types";

type DeliveryViewSheetProps = {
  delivery: Delivery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (delivery: Delivery) => void;
  onDelete: (delivery: Delivery) => void;
};

export function DeliveryViewSheet({
  delivery,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: DeliveryViewSheetProps) {
  const { notifySuccess } = useFeedback();
  const [addPackagesOpen, setAddPackagesOpen] = useState(false);
  const barcodesQuery = useDeliveryBarcodes(delivery?.id ?? null, open && Boolean(delivery));

  const groups = useMemo(
    () => groupDeliveryBarcodes(barcodesQuery.data ?? []),
    [barcodesQuery.data],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-[760px] max-w-[94vw] flex-col p-0">
          {delivery ? (
            <>
              <SheetHeader className="border-b px-6 py-5 pr-16">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{delivery.name}</SheetTitle>
                    <SheetDescription>
                      {formatDeliveryId(delivery.id)} · {formatDeliveryDate(delivery.date)}
                    </SheetDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {groups.length} invoice groups
                  </Badge>
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-6 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Car className="size-4 text-primary" />
                      Container
                    </div>
                    <p className="text-sm">{delivery.container?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {delivery.container?.containerNumber || "No container number"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Users className="size-4 text-primary" />
                      Employee group
                    </div>
                    <p className="text-sm">{delivery.employeeGroup?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {delivery.employeeGroup?.id
                        ? `Group ${delivery.employeeGroup.id}`
                        : "No employee group assigned"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Packages in delivery</p>
                      <p className="text-xs text-muted-foreground">
                        Invoice line items grouped with their package barcodes.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setAddPackagesOpen(true)}>
                      <PackagePlus className="size-4" />
                      Add packages
                    </Button>
                  </div>

                  {barcodesQuery.isLoading ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Loading delivery packages...</p>
                  ) : groups.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">
                      No packages have been added to this delivery.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {groups.map((group) => (
                        <details key={group.key} className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {group.invoice?.number ?? group.description}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {group.description}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{group.labels} labels</Badge>
                              <span>{group.quantity} qty</span>
                            </div>
                          </summary>
                          <div className="overflow-x-auto border-t bg-muted/30">
                            <table className="w-full min-w-[560px] text-sm">
                              <thead>
                                <tr className="text-left text-xs uppercase text-muted-foreground">
                                  <th className="px-4 py-2 font-medium">Barcode</th>
                                  <th className="px-4 py-2 font-medium">Status</th>
                                  <th className="px-4 py-2 font-medium">Container</th>
                                  <th className="px-4 py-2 font-medium">Scanned</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.barcodes.map((barcode) => (
                                  <tr key={barcode.id} className="border-t">
                                    <td className="px-4 py-2 font-mono text-xs">
                                      {barcode.number || formatDeliveryId(barcode.id)}
                                    </td>
                                    <td className="px-4 py-2">{barcode.status?.name || "-"}</td>
                                    <td className="px-4 py-2">{barcode.container?.name || "-"}</td>
                                    <td className="px-4 py-2 text-muted-foreground">
                                      {barcode.scanDate ? formatDeliveryDate(barcode.scanDate) : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 justify-between gap-2 border-t bg-card px-6 py-4">
                <Button variant="destructive" onClick={() => onDelete(delivery)}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                <Button onClick={() => onEdit(delivery)}>
                  <Edit className="size-4" />
                  Edit delivery
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {delivery ? (
        <AddDeliveryPackagesDialog
          delivery={delivery}
          open={addPackagesOpen}
          onOpenChange={setAddPackagesOpen}
          onCompleted={(results) => {
            const successCount = results.filter((result) => !result.hasError).length;
            if (successCount > 0) {
              notifySuccess(
                `${successCount} package${successCount === 1 ? "" : "s"} added to ${delivery.name}.`,
              );
            }
          }}
        />
      ) : null}
    </>
  );
}
