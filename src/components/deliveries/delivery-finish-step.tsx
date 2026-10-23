"use client";

import { Box, ClipboardCheck, FileSignature, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { useDeliveryWizard } from "@/lib/deliveries/hooks/use-delivery-wizard";
import { useTranslation } from "@/lib/i18n";
type WizardState = ReturnType<typeof useDeliveryWizard>;

export function DeliveryFinishStep({ state }: { state: WizardState }) {
  const { t } = useTranslation();
  const review = state.query.data;
  if (!review) return null;
  const values = state.form.watch();

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-input bg-muted p-4">
          <Box className="size-7 text-primary" />
          <div>
            <p className="font-medium">
              {t("deliveries.wizard.deliveryNumber", { id: review.deliveryId })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("deliveries.wizard.selectedCount", {
                count: values.barcodeIds.length,
                total: review.barcodes.length,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-input bg-muted p-4">
          <ClipboardCheck className="size-7 text-primary" />
          <p className="text-sm font-medium">
            {t("deliveries.wizard.photoCount", {
              count: state.photos.documentIds.length,
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-input bg-muted p-4">
          <User className="size-7 text-primary" />
          <div className="min-w-0">
            <p className="break-words font-medium">{values.signerName}</p>
            <p className="break-words text-sm text-muted-foreground">
              {t("deliveries.wizard.receiverId", { id: values.idNumber })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <FileSignature className="size-7" />
          <span className="text-sm font-medium">
            {t("deliveries.wizard.signatureCaptured")}
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-input bg-muted p-4">
        <p className="mb-2 text-sm font-medium">
          {t("deliveries.wizard.newStatus")}
        </p>
        <Badge>{review.deliveredStatus.name}</Badge>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("deliveries.wizard.remainingConduce", {
            pendingStatus: review?.pendingStatus.name,
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("deliveries.wizard.confirmReceived")}
      </p>
      {state.locked ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("deliveries.wizard.retrySameReceipt")}
        </p>
      ) : null}
    </>
  );
}
