"use client";

import { Box, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { useDeliveryWizard } from "@/lib/deliveries/hooks/use-delivery-wizard";
import { useTranslation } from "@/lib/i18n";
type WizardState = ReturnType<typeof useDeliveryWizard>;

export function DeliveryReviewStep({ state }: { state: WizardState }) {
  const { t } = useTranslation();
  const review = state.query.data;
  if (!review) return null;
  const values = state.form.watch();
  const errors = state.form.formState.errors;
  const locked = state.busy || state.locked;
  const address = [
    review.receiver?.address?.address1,
    review.receiver?.address?.apartment,
    review.receiver?.address?.city,
    review.receiver?.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <div className="space-y-2 rounded-xl border border-input bg-muted p-4 md:hidden">
        <p className="flex items-center gap-2 font-medium">
          <User className="size-4" />
          {review.receiver?.name || "—"}
        </p>
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {address || "—"}
        </p>
      </div>
      <p className="text-sm font-medium">
        {t("deliveries.wizard.selectedCount", {
          count: values.barcodeIds.length,
          total: review.barcodes.length,
        })}
      </p>
      <fieldset disabled={locked} className="space-y-3">
        <legend className="sr-only">{t("deliveries.deliver.items")}</legend>
        {review.barcodes.map((barcode) => (
          <label
            key={barcode.barcodeId}
            className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-input bg-card p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2"
          >
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={values.barcodeIds.includes(barcode.barcodeId)}
              onChange={() => state.toggleBarcode(barcode.barcodeId)}
              aria-label={`${barcode.description} · ${barcode.number}`}
            />
            <Box className="size-8 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium">
                {barcode.description}
              </span>
              <span className="block break-words text-xs text-muted-foreground">
                {barcode.number}
              </span>
            </span>
            <Badge variant="outline" className="border-input bg-card">{review.pendingStatus.name}</Badge>
          </label>
        ))}
      </fieldset>
      {errors.barcodeIds ? (
        <p role="alert" className="text-sm text-destructive">
          {t("deliveries.wizard.selectItems")}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {t("deliveries.wizard.remainingConduce", {
          pendingStatus: review?.pendingStatus.name,
        })}
      </p>
    </>
  );
}
