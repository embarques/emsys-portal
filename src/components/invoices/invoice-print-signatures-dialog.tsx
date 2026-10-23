"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInvoicePrintSignatures } from "@/lib/invoices/hooks/use-invoice-print-signatures";
import type { InvoicePrintDelivery, ReceiverSignatureOption } from "@/lib/invoices/schemas/invoice-print.schema";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";

export function InvoicePrintSignaturesDialog({ invoiceIds, onClose, trip }: {
  invoiceIds: string[];
  onClose: () => void;
  trip?: InvoicePrintDelivery;
}) {
  const { t, locale } = useTranslation();
  const state = useInvoicePrintSignatures(invoiceIds, onClose, trip);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"sender" | "latest">("sender");
  const rows = state.query.data ?? [];
  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const first = currentPage * pageSize;
  const selections = state.form.watch("selections");
  const ready = state.query.isSuccess && state.initialized && state.canPrint && state.withinLimit;
  function optionLabel(signature: ReceiverSignatureOption) {
    const tripLabel = signature.deliveryId && signature.deliveryId !== "0" ? t("invoices.printSignatures.delivery", { number: signature.deliveryId }) : t("invoices.printSignatures.earlierReceipt");
    const date = signature.signedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(signature.signedAt)) : "";
    return [tripLabel, signature.deliveryName, date, signature.signerName].filter(Boolean).join(" · ");
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !state.busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-3xl" aria-busy={state.busy}>
        <DialogHeader>
          <DialogTitle>{t("invoices.printSignatures.title")}</DialogTitle>
          <DialogDescription>{ready && rows.length === 1
            ? t("invoices.printSignatures.descriptionSingle", { number: rows[0].invoiceNumber })
            : t("invoices.printSignatures.description", { count: state.invoiceCount })}</DialogDescription>
        </DialogHeader>
        {!state.canPrint ? <p role="alert">{t("invoices.printSignatures.noAccess")}</p>
          : !state.withinLimit ? <p role="alert">{t("invoices.printSignatures.limit")}</p>
          : state.query.isError ? <div className="space-y-3"><p role="alert" className="text-destructive">{normalizeApiError(state.query.error).message}</p><Button type="button" variant="outline" onClick={() => void state.query.refetch()}>{t("invoices.printSignatures.retry")}</Button></div>
          : !ready ? <p role="status">{t("invoices.printSignatures.loading")}</p>
          : <form onSubmit={(event) => void state.submit(event)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-y-auto"><fieldset disabled={state.busy} className="min-w-0 space-y-5">
              {rows.length > 1 ? <div className="space-y-2">
                <label htmlFor="print-signature-default" className="text-sm font-medium">{t("invoices.printSignatures.applyLabel", { count: rows.length })}</label>
                <div className="flex flex-wrap gap-2">
                  <select id="print-signature-default" value={mode} onChange={(event) => setMode(event.target.value === "latest" ? "latest" : "sender")} className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-base sm:text-sm">
                    <option value="sender">{t("invoices.printSignatures.senderOnly")}</option>
                    <option value="latest">{t("invoices.printSignatures.latest")}</option>
                  </select>
                  <Button type="button" variant="outline" onClick={() => state.applyDefault(mode)}>{t("invoices.printSignatures.applyAll")}</Button>
                </div>
              </div> : null}
              {rows.length === 1 && !rows[0].senderSignature && rows[0].receiverSignatures.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{t("invoices.printSignatures.noSignatures")}</p> : null}
              <div>
                <h3 className="mb-2 text-sm font-medium">{t("invoices.printSignatures.review")}</h3>
                <div className="hidden grid-cols-[minmax(0,1fr)_72px_minmax(0,2fr)] gap-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:grid" aria-hidden>
                  <span>{t("invoices.printSignatures.invoice")}</span><span className="text-center">{t("invoices.printSignatures.sender")}</span><span>{t("invoices.printSignatures.receiver")}</span>
                </div>
                {rows.slice(first, first + pageSize).map((row, offset) => {
                  const index = first + offset;
                  return <div key={row.invoiceId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-3 sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,2fr)] sm:px-3">
                    <div className="min-w-0"><p className="break-words text-sm font-medium">{row.invoiceNumber}</p><p className="break-words text-xs text-muted-foreground">{row.senderSignature?.signerName || t("invoices.printSignatures.noSender")}</p></div>
                    <label className="flex min-h-11 items-center justify-center gap-2 text-xs"><span className="sm:hidden">{t("invoices.printSignatures.sender")}</span><input type="checkbox" {...state.form.register(`selections.${index}.includeSender`)} disabled={state.busy || !row.senderSignature} aria-label={t("invoices.printSignatures.includeSender", { number: row.invoiceNumber })} className="size-4 accent-primary" /></label>
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      {row.receiverSignatures.length ? <><label htmlFor={`print-receiver-${row.invoiceId}`} className="sr-only">{t("invoices.printSignatures.receiverFor", { number: row.invoiceNumber })}</label><select id={`print-receiver-${row.invoiceId}`} {...state.form.register(`selections.${index}.receiverSignatureId`)} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-2 text-base sm:text-sm">
                        <option value="">{t("invoices.printSignatures.none")}</option>
                        {row.receiverSignatures.map((signature) => <option key={signature.id} value={signature.id}>{optionLabel(signature)}</option>)}
                      </select></> : <p className="py-2 text-sm text-muted-foreground">{t("invoices.printSignatures.noReceivers")}</p>}
                    </div>
                  </div>;
                })}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t("invoices.printSignatures.range", { first: first + 1, last: Math.min(rows.length, first + pageSize), total: rows.length })}</span>
                  <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={state.busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("invoices.printSignatures.previous")}</Button><span>{currentPage + 1} / {pages}</span><Button type="button" size="sm" variant="outline" disabled={state.busy || currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>{t("invoices.printSignatures.next")}</Button></div>
                </div>
              </div>
            </fieldset></div>
            <p className="text-xs text-muted-foreground" aria-live="polite">{t("invoices.printSignatures.selected", { count: selections.filter((selection) => selection.receiverSignatureId).length, total: rows.length })}</p>
            {state.form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.root.message}</p> : null}
            <DialogFooter className="static"><Button type="button" variant="outline" disabled={state.busy} onClick={onClose}>{t("invoices.printSignatures.cancel")}</Button><Button type="submit" disabled={state.busy || !ready}><Printer className="size-4" />{state.busy ? t("invoices.printSignatures.printing") : rows.length === 1 ? t("invoices.printSignatures.printSingle") : t("invoices.printSignatures.print", { count: rows.length })}</Button></DialogFooter>
          </form>}
        {!ready ? <DialogFooter className="static"><Button type="button" variant="outline" onClick={onClose}>{t("invoices.printSignatures.cancel")}</Button></DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
