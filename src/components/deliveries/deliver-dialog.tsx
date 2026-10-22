"use client";

import { InvoiceDocumentPicker } from "@/components/invoices/invoice-document-picker";
import { SignaturePad } from "@/components/invoices/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeliverInvoice, type DeliverTarget } from "@/lib/deliveries/hooks/use-deliver-invoice";
import { useTranslation } from "@/lib/i18n";

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

export function DeliverDialog({ target, onClose, onDelivered }: {
  target: DeliverTarget;
  onClose: () => void;
  onDelivered: () => void;
}) {
  const { t } = useTranslation();
  const { form, query, policies, statusOptions, submit, reviewKey, documents, busy, canDeliver, signatureSaved, invoiceReceiver, fillFromInvoiceReceiver } = useDeliverInvoice(target, onDelivered);
  const group = query.data;
  const errors = form.formState.errors;
  const signature = form.watch("signatureDataUrl");
  const statusId = form.watch("statusId");
  const agreed = form.watch("agreed");
  const policyList = policies.data ?? [];
  const policiesBlocked = policies.isPending || policies.isError;
  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("deliveries.deliver.title")}</DialogTitle>
          <DialogDescription>{t("deliveries.deliver.description")}</DialogDescription>
        </DialogHeader>
        {!canDeliver ? <p role="alert">{t("deliveries.deliver.unavailable")}</p> : query.isPending ? (
          <p role="status">{t("common.loading")}</p>
        ) : query.isError ? (
          <div className="space-y-2">
            <p role="alert" className="text-destructive">{t("deliveries.deliver.loadError")}</p>
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t("deliveries.deliver.retry")}</Button>
          </div>
        ) : !group ? <p role="alert">{t("deliveries.deliver.changed")}</p> : (
          <form onSubmit={(event) => void submit(event)} className="space-y-5">
            <div className="rounded-lg border p-3">
              <p className="font-medium">{group.invoiceNumber} · {group.routeName}</p>
              <p className="text-sm text-muted-foreground">{t("deliveries.deliver.count", { items: group.items.length, barcodes: group.barcodeCount })}</p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto" aria-label={t("deliveries.deliver.items")}>
                {group.items.map((item) => <li key={item.lineItemId}>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="break-words text-xs text-muted-foreground">{item.barcodes.map((entry) => entry.number).join(", ")}</p>
                </li>)}
              </ul>
            </div>

            <fieldset disabled={busy} className="space-y-5">
              <section className="space-y-2">
                <Label htmlFor="deliver-status">{t("deliveries.deliver.status")}</Label>
                <SearchableSelect
                  id="deliver-status"
                  options={statusOptions.map((option) => ({ value: String(option.id), label: option.label, keywords: [option.name] }))}
                  value={statusId}
                  onValueChange={(value) => form.setValue("statusId", value, { shouldValidate: true, shouldDirty: true })}
                  placeholder={t("deliveries.deliver.statusPlaceholder")}
                  searchPlaceholder={t("deliveries.deliver.statusSearch")}
                  emptyMessage={t("deliveries.deliver.statusEmpty")}
                  disabled={busy}
                />
                <p className="text-sm text-muted-foreground">{t("deliveries.deliver.statusHint")}</p>
                {errors.statusId && <p role="alert" className="text-sm text-destructive">{errors.statusId.message}</p>}
              </section>

              <section className="space-y-3">
                <SectionTitle>{t("deliveries.deliver.documents")}</SectionTitle>
                <InvoiceDocumentPicker
                  files={documents.files}
                  invalid={documents.invalid}
                  disabled={busy || !group.containerId}
                  description={t("deliveries.deliver.documentsHint")}
                  allowVideoCapture
                  onAdd={documents.add}
                  onRemove={documents.remove}
                />
                {!group.containerId && <p className="text-sm text-muted-foreground">{t("invoices.documents.containerRequired")}</p>}
                <Button type="button" variant="outline" disabled={busy || !group.containerId || !documents.hasPending} onClick={() => void documents.upload()}>
                  {t(documents.busy ? "deliveries.deliver.uploading" : "deliveries.deliver.uploadDocuments")}
                </Button>
                {documents.hasPending && <p className="text-sm text-muted-foreground">{t("deliveries.deliver.pendingDocuments")}</p>}
                <ul aria-live="polite" className="space-y-2">
                  {documents.progress.map((item) => <li key={item.name} className="rounded border p-2 text-sm">
                    <div className="flex justify-between gap-2"><span className="break-all">{item.name}</span><span>{item.done ? t("invoices.documents.done") : `${item.percent}%`}</span></div>
                    <progress value={item.percent} max={100} aria-label={item.name} className="mt-1 w-full" />
                  </li>)}
                </ul>
                {documents.error && <p role="alert" className="text-sm text-destructive">{documents.error}</p>}
              </section>

              <section className="space-y-3">
                <SectionTitle>{t("deliveries.deliver.terms")}</SectionTitle>
                {policies.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : policies.isError ? (
                  <div className="space-y-2">
                    <p role="alert" className="text-sm text-destructive">{t("deliveries.deliver.termsLoadError")}</p>
                    <Button type="button" variant="outline" onClick={() => void policies.refetch()}>{t("deliveries.deliver.retry")}</Button>
                  </div>
                ) : !policyList.length ? <p className="text-sm text-muted-foreground">{t("deliveries.deliver.noTerms")}</p> : <>
                  <div role="region" aria-label={t("deliveries.deliver.terms")} tabIndex={0}
                    className="max-h-[min(40dvh,20rem)] overflow-y-auto overscroll-contain rounded-lg border border-border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ol className="space-y-3">
                      {policyList.map((policy, index) => <li key={policy.id} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                        <p className="text-sm font-semibold text-foreground">{index + 1}. {policy.title}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{policy.body}</p>
                      </li>)}
                    </ol>
                  </div>
                  <Label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <input type="checkbox" className="mt-1 size-4" checked={agreed}
                      onChange={(event) => form.setValue("agreed", event.target.checked, { shouldDirty: true })}
                      aria-invalid={Boolean(errors.agreed)} />
                    <span className="text-sm leading-snug text-foreground">{t("deliveries.deliver.agree")}</span>
                  </Label>
                  {errors.agreed && <p role="alert" className="text-sm text-destructive">{errors.agreed.message}</p>}
                </>}
              </section>

              <section className="space-y-4">
                <SectionTitle>{t("deliveries.deliver.receiver")}</SectionTitle>
                {!signatureSaved && <p className="text-sm text-muted-foreground">
                  {t(policyList.length ? "deliveries.deliver.signatureCoversTerms" : "deliveries.deliver.signatureCoversDelivery")}
                </p>}
                {signatureSaved ? <p role="status" className="text-sm text-muted-foreground">{t("deliveries.deliver.signatureSaved")}</p> : <>
                  <p className="text-sm text-muted-foreground">{t("deliveries.deliver.receiverHint")}</p>
                  {invoiceReceiver.name || invoiceReceiver.idNumber ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                      <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
                        {t("deliveries.deliver.invoiceReceiver", { name: [invoiceReceiver.name, invoiceReceiver.idNumber].filter(Boolean).join(" · ") })}
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={fillFromInvoiceReceiver}>
                        {t("deliveries.deliver.sameAsInvoiceReceiver")}
                      </Button>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <Label htmlFor="deliver-signer-name">{t("deliveries.deliver.signerName")}</Label>
                    <Input id="deliver-signer-name" autoComplete="name" {...form.register("signerName")} aria-invalid={Boolean(errors.signerName)} aria-describedby={errors.signerName ? "deliver-name-error" : undefined} />
                    {errors.signerName && <p id="deliver-name-error" role="alert" className="text-sm text-destructive">{errors.signerName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deliver-id-number">{t("deliveries.deliver.idNumber")}</Label>
                    <Input id="deliver-id-number" {...form.register("idNumber")} aria-invalid={Boolean(errors.idNumber)} aria-describedby={errors.idNumber ? "deliver-id-error" : undefined} />
                    {errors.idNumber && <p id="deliver-id-error" role="alert" className="text-sm text-destructive">{errors.idNumber.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t("deliveries.deliver.signature")}</p>
                    <SignaturePad key={reviewKey} value={signature || null} disabled={busy} aria-label={t("deliveries.deliver.signature")} onChange={(value) => form.setValue("signatureDataUrl", value ?? "", { shouldValidate: true, shouldDirty: true })} />
                    {errors.signatureDataUrl && <p role="alert" className="text-sm text-destructive">{errors.signatureDataUrl.message}</p>}
                  </div>
                </>}
              </section>
            </fieldset>

            {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common.actions.cancel")}</Button>
              <Button type="submit" disabled={busy || documents.hasPending || query.isFetching || policiesBlocked}>
                {t(busy ? "deliveries.deliver.saving" : signatureSaved ? "deliveries.deliver.retryStatus" : "deliveries.deliver.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
