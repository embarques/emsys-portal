"use client";

import { SignaturePad } from "@/components/invoices/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useDeliveryWizard } from "@/lib/deliveries/hooks/use-delivery-wizard";
import { useTranslation } from "@/lib/i18n";
type WizardState = ReturnType<typeof useDeliveryWizard>;

export function DeliverySignatureStep({ state }: { state: WizardState }) {
  const { t } = useTranslation();
  const review = state.query.data;
  if (!review) return null;
  const values = state.form.watch();
  const errors = state.form.formState.errors;
  const locked = state.busy || state.locked;
  const policyList = state.policies.data ?? [];
  return (
    <fieldset disabled={locked} className="min-w-0 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="delivery-receiver-name">
          {t("deliveries.deliver.signerName")}
        </Label>
        <Input
          id="delivery-receiver-name"
          className="bg-background"
          autoComplete="name"
          {...state.form.register("signerName")}
          aria-invalid={Boolean(errors.signerName)}
        />
        {errors.signerName ? (
          <p role="alert" className="text-xs text-destructive">
            {t("deliveries.deliver.required")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="delivery-receiver-id">
          {t("deliveries.deliver.idNumber")}
        </Label>
        <Input
          id="delivery-receiver-id"
          className="bg-background"
          {...state.form.register("idNumber")}
          aria-invalid={Boolean(errors.idNumber)}
        />
        {errors.idNumber ? (
          <p role="alert" className="text-xs text-destructive">
            {t("deliveries.wizard.validReceiverId")}
          </p>
        ) : null}
      </div>
      {review.receiver?.name || review.receiver?.idNumber ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={state.fillFromInvoiceReceiver}
        >
          {t("deliveries.deliver.sameAsInvoiceReceiver")}
        </Button>
      ) : null}
      <section className="space-y-3">
        {state.policies.isPending ? (
          <p role="status">{t("common.loading")}</p>
        ) : state.policies.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {t("deliveries.deliver.termsLoadError")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void state.policies.refetch()}
            >
              {t("deliveries.deliver.retry")}
            </Button>
          </div>
        ) : policyList.length ? (
          <>
            <div
              role="region"
              aria-label={t("deliveries.deliver.terms")}
              tabIndex={0}
              className="max-h-40 space-y-3 overflow-y-auto rounded-xl border border-input bg-muted p-3"
            >
              {policyList.map((policy) => (
                <div key={policy.id}>
                  <p className="text-sm font-semibold">{policy.title}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {policy.body}
                  </p>
                </div>
              ))}
            </div>
            <Label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-primary"
                {...state.form.register("agreed")}
              />
              <span className="text-sm leading-relaxed">
                {t("deliveries.deliver.agree")}
              </span>
            </Label>
            {errors.agreed ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.agreed.message}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("deliveries.deliver.noTerms")}
          </p>
        )}
      </section>
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("deliveries.deliver.signature")}
        </p>
        <SignaturePad
          value={values.signatureDataUrl || null}
          disabled={locked}
          aria-label={t("deliveries.deliver.signature")}
          onChange={(value) =>
            state.form.setValue("signatureDataUrl", value ?? "", {
              shouldValidate: true,
            })
          }
        />
        {errors.signatureDataUrl ? (
          <p role="alert" className="text-sm text-destructive">
            {t("deliveries.deliver.signatureRequired")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t("deliveries.wizard.automaticMetadata")}
        </p>
      </div>
    </fieldset>
  );
}
