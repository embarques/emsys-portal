"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  PackageCheck,
  Printer,
  User,
} from "lucide-react";
import { DeliveryReviewStep } from "@/components/deliveries/delivery-review-step";
import { DeliverySignatureStep } from "@/components/deliveries/delivery-signature-step";
import { DeliveryFinishStep } from "@/components/deliveries/delivery-finish-step";
import { InvoicePrintSignaturesDialog } from "@/components/invoices/invoice-print-signatures-dialog";
import { DeliveryPhotoPicker } from "@/components/deliveries/delivery-photo-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeliveryWizard } from "@/lib/deliveries/hooks/use-delivery-wizard";
import type { DeliverTarget } from "@/lib/deliveries/hooks/use-deliver-invoice";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DeliveryWizard({
  target,
  onClose,
  onDelivered,
}: {
  target: DeliverTarget;
  onClose: () => void;
  onDelivered: () => void;
}) {
  const { t } = useTranslation();
  const state = useDeliveryWizard(target);
  const [print, setPrint] = useState(false);
  const review = state.query.data;
  const values = state.form.watch();
  const errors = state.form.formState.errors;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [state.step]);
  const steps = ["review", "photos", "signature", "finish"] as const;
  const close = () => {
    if (!state.busy) {
      if (state.finished) onDelivered();
      else onClose();
    }
  };
  const address = [
    review?.receiver?.address?.address1,
    review?.receiver?.address?.apartment,
    review?.receiver?.address?.city,
    review?.receiver?.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const locked = state.busy || state.locked;

  function progress(vertical = false) {
    return (
      <ol
        aria-label={t("deliveries.wizard.progress")}
        className={vertical ? "space-y-6" : "grid grid-cols-4 gap-2"}
      >
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === state.step ? "step" : undefined}
            className={cn(
              vertical
                ? "flex items-center gap-3"
                : "flex flex-col items-center gap-2",
              index === state.step
                ? "font-semibold text-primary"
                : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm",
                index <= state.step
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30",
              )}
            >
              {index < state.step ? <Check className="size-4" /> : index + 1}
            </span>
            <span className="text-xs sm:text-sm">
              {t(`deliveries.wizard.steps.${step}`)}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  const summary = (
    <aside className="hidden self-start rounded-xl border bg-muted/20 p-4 md:block">
      <h3 className="mb-4 text-sm font-semibold">
        {t("deliveries.wizard.summary")}
      </h3>
      <div className="space-y-5 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("deliveries.wizard.invoice")}
          </p>
          <p className="break-words font-medium">{review?.invoiceNumber}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t("deliveries.wizard.delivery")}
          </p>
          <p className="break-words font-medium">
            {review?.deliveryName || `#${review?.deliveryId}`}
          </p>
        </div>
        <div>
          <User className="mb-1 size-4 text-muted-foreground" />
          <p className="break-words font-medium">
            {review?.receiver?.name || "—"}
          </p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {address}
          </p>
        </div>
        <div>
          <p className="font-medium">
            {t("deliveries.wizard.selectedCount", {
              count: values.barcodeIds.length,
              total: review?.barcodes.length ?? 0,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("deliveries.wizard.remainingConduce", {
              pendingStatus: review?.pendingStatus.name ?? "",
            })}
          </p>
        </div>
      </div>
    </aside>
  );
  return (
    <>
      <Dialog
        open={!print}
        onOpenChange={(open) => {
          if (!open && !print) close();
        }}
      >
        <DialogContent
          className="h-[100dvh] max-h-[100dvh] max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-[min(90dvh,900px)] sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:rounded-xl"
          aria-busy={state.busy}
        >
          <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
            <DialogTitle>
              {state.finished
                ? t("deliveries.wizard.successTitle")
                : t("deliveries.wizard.title")}
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">
                {review?.invoiceNumber || target.number}
              </span>
              {" · "}
              {t("deliveries.wizard.deliveryNumber", {
                id: target.delivery?.id ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          {!state.access.canDeliver ? (
            <p role="alert" className="p-6">
              {t("deliveries.deliver.unavailable")}
            </p>
          ) : state.query.isPending ? (
            <p role="status" className="p-6">
              {t("common.loading")}
            </p>
          ) : state.query.isError || !review ? (
            <div className="space-y-4 p-6">
              <p role="alert">{t("deliveries.deliver.loadError")}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void state.query.refetch()}
              >
                {t("deliveries.deliver.retry")}
              </Button>
            </div>
          ) : state.finished ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
              <CheckCircle2 className="size-16 text-emerald-600" />
              <h2 className="text-2xl font-semibold">
                {t("deliveries.wizard.successTitle")}
              </h2>
              <p className="max-w-md text-muted-foreground">
                {t("deliveries.wizard.successHint", {
                  count: values.barcodeIds.length,
                  pendingStatus: review?.pendingStatus.name ?? "",
                  deliveredStatus: review?.deliveredStatus.name ?? "",
                })}
              </p>
              <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
                {state.access.canPrint ? (
                  <Button
                    type="button"
                    className="min-h-11 flex-1"
                    onClick={() => setPrint(true)}
                  >
                    <Printer className="size-4" />
                    {t("invoices.printSignatures.action")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={close}
                >
                  {t("deliveries.wizard.done")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (state.step === 3) void state.submit(event);
                else void state.next();
              }}
              className="flex min-h-0 flex-1"
            >
              <nav className="hidden w-44 shrink-0 border-r bg-muted/15 p-5 lg:block">
                {progress(true)}
              </nav>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <nav className="shrink-0 border-b px-5 py-4 lg:hidden">
                  {progress()}
                </nav>
                <div className="grid min-h-0 flex-1 items-start gap-6 overflow-y-auto p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_200px] xl:grid-cols-[minmax(0,1fr)_230px]">
                  <section className="min-w-0 space-y-5">
                    <div>
                      <h2
                        ref={heading}
                        tabIndex={-1}
                        className="text-xl font-semibold tracking-tight outline-none sm:text-2xl"
                      >
                        {t(`deliveries.wizard.headings.${steps[state.step]}`)}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t(`deliveries.wizard.hints.${steps[state.step]}`)}
                      </p>
                    </div>
                    {state.step === 0 ? (
                      <DeliveryReviewStep state={state} />
                    ) : null}
                    {state.step === 1 ? (
                      <>
                        <DeliveryPhotoPicker
                          photos={state.photos.photos}
                          onAdd={state.photos.add}
                          onRemove={state.photos.remove}
                          disabled={locked}
                        />
                        {state.photos.error ? (
                          <p role="alert" className="text-sm text-destructive">
                            {state.photos.error}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {state.step === 2 ? (
                      <DeliverySignatureStep state={state} />
                    ) : null}
                    {state.step === 3 ? (
                      <DeliveryFinishStep state={state} />
                    ) : null}
                  </section>
                  {summary}
                </div>
                <footer className="shrink-0 space-y-3 border-t bg-background px-5 py-4 sm:px-6">
                  {errors.root?.message ? (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.root.message}
                    </p>
                  ) : null}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 flex-1 sm:flex-none"
                      disabled={state.busy || state.locked}
                      onClick={state.step === 0 ? close : state.back}
                    >
                      <ArrowLeft className="size-4" />
                      {t(
                        state.step === 0
                          ? "common.actions.cancel"
                          : "deliveries.wizard.back",
                      )}
                    </Button>
                    <Button
                      type="submit"
                      className="min-h-12 flex-1 sm:ml-auto sm:min-w-44 sm:flex-none"
                      disabled={
                        state.busy ||
                        (state.step === 2 &&
                          (state.policies.isPending || state.policies.isError))
                      }
                    >
                      {state.step === 3 ? (
                        <PackageCheck className="size-4" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                      {t(
                        state.busy
                          ? "deliveries.wizard.saving"
                          : state.step === 3
                            ? "deliveries.deliver.submit"
                            : "deliveries.wizard.continue",
                      )}
                    </Button>
                  </div>
                </footer>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {print && review ? (
        <InvoicePrintSignaturesDialog
          invoiceIds={[review.invoiceId]}
          trip={{ deliveryId: String(review.deliveryId) }}
          onClose={() => { setPrint(false); close(); }}
        />
      ) : null}
    </>
  );
}
