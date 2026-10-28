"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { ArrowLeft, Info, PenLine, Printer, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useInvoicePrintSignatures } from "@/lib/invoices/hooks/use-invoice-print-signatures";
import type { InvoicePrintDelivery, InvoiceSignatureOptions } from "@/lib/invoices/schemas/invoice-print.schema";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";

const PAGE_SIZE = 10;

function hasSignatures(row: InvoiceSignatureOptions) {
  return row.senderSignature !== null || row.receiverSignatures.length > 0;
}

export function InvoicePrintSignaturesDialog({ invoiceIds, onClose, trip }: {
  invoiceIds: string[];
  onClose: () => void;
  trip?: InvoicePrintDelivery;
}) {
  const { t, locale } = useTranslation();
  const state = useInvoicePrintSignatures(invoiceIds, onClose, trip);
  const [page, setPage] = useState(0);
  const [showUnsigned, setShowUnsigned] = useState(false);
  const rows = state.query.data ?? [];
  const multiple = rows.length > 1;
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const signedRows = indexedRows.filter(({ row }) => hasSignatures(row));
  const unsignedCount = rows.length - signedRows.length;
  const anyReceivers = signedRows.some(({ row }) => row.receiverSignatures.length > 0);
  const visibleRows = !multiple || showUnsigned ? indexedRows : signedRows;
  const pages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const first = currentPage * PAGE_SIZE;
  const selections = state.form.watch("selections");
  const senderCount = selections.filter((selection) => selection.includeSender).length;
  const receiverCount = selections.filter((selection) => selection.receiverSignatureId).length;
  const ready = state.query.isSuccess && state.initialized && state.canPrint && state.withinLimit;
  function receiverOptions(row: InvoiceSignatureOptions): SearchableSelectOption[] {
    return [{ value: "", label: t("invoices.printSignatures.none") }, ...row.receiverSignatures.map((signature) => {
      const tripLabel = signature.deliveryId && signature.deliveryId !== "0" ? t("invoices.printSignatures.delivery", { number: signature.deliveryId }) : t("invoices.printSignatures.earlierReceipt");
      const date = signature.signedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(signature.signedAt)) : "";
      const details = [tripLabel, signature.deliveryName].filter(Boolean).join(" · ");
      return {
        value: signature.id,
        label: [signature.signerName, date].filter(Boolean).join(" · ") || details,
        description: details,
        keywords: [tripLabel, signature.deliveryName ?? "", date],
      };
    })];
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !state.busy) onClose(); }}>
      <DialogContent centerInWorkspace className="inset-0 h-[100dvh] max-h-[100dvh] max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button]:hidden sm:inset-auto sm:left-[var(--workspace-body-center-x,50%)] sm:top-[var(--workspace-body-center-y,50%)] sm:h-auto sm:max-h-[min(90dvh,calc(var(--workspace-body-height,100dvh)-2rem))] sm:max-w-[min(48rem,calc(var(--workspace-body-width,100vw)-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-foreground/25 sm:p-6 sm:[&>button]:inline-flex" aria-busy={state.busy}>
        <DialogHeader>
          <Button type="button" variant="ghost" disabled={state.busy} onClick={onClose} className="mb-2 min-h-11 self-start px-0 sm:hidden"><ArrowLeft className="size-4" />{t(trip ? "invoices.printSignatures.backToDeliveries" : "invoices.printSignatures.backToInvoices")}</Button>
          <DialogTitle>{t("invoices.printSignatures.title")}</DialogTitle>
          <DialogDescription className="text-foreground/80">{ready && rows.length === 1
            ? t("invoices.printSignatures.descriptionSingle", { number: rows[0].invoiceNumber })
            : t("invoices.printSignatures.description", { count: state.invoiceCount })}</DialogDescription>
        </DialogHeader>
        {!state.canPrint ? <p role="alert">{t("invoices.printSignatures.noAccess")}</p>
          : !state.withinLimit ? <p role="alert">{t("invoices.printSignatures.limit")}</p>
          : state.query.isError ? <div className="space-y-3"><p role="alert" className="text-destructive">{normalizeApiError(state.query.error).message}</p><Button type="button" variant="outline" onClick={() => void state.query.refetch()}>{t("invoices.printSignatures.retry")}</Button></div>
          : !ready ? <p role="status">{t("invoices.printSignatures.loading")}</p>
          : <form onSubmit={(event) => void state.submit(event)} className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-y-auto"><fieldset disabled={state.busy} className="min-w-0 space-y-5">
              {signedRows.length === 0 ? <p role="status" className="flex items-start gap-2 rounded-md border border-foreground/20 bg-muted px-3 py-3 text-sm text-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {multiple ? t("invoices.printSignatures.allUnsigned", { count: rows.length }) : t("invoices.printSignatures.noSignatures")}
              </p> : <>
                {multiple ? <section aria-labelledby="print-signature-default-label" className="space-y-3 rounded-lg border border-foreground/20 bg-muted/40 p-3">
                  <div>
                    <h3 id="print-signature-default-label" className="text-sm font-medium">{t("invoices.printSignatures.applyLabel", { count: rows.length })}</h3>
                    <p className="text-xs text-foreground/80">{t("invoices.printSignatures.applyHint")}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => state.applyDefault("sender")} className="h-auto min-h-11 justify-start whitespace-normal bg-background text-left"><UserCheck className="size-4 shrink-0" aria-hidden />{t("invoices.printSignatures.senderOnly")}</Button>
                    <Button type="button" variant="outline" disabled={!anyReceivers} onClick={() => state.applyDefault("latest")} className="h-auto min-h-11 justify-start whitespace-normal bg-background text-left"><PenLine className="size-4 shrink-0" aria-hidden />{t("invoices.printSignatures.latest")}</Button>
                  </div>
                </section> : null}
                <div>
                  <h3 className="text-sm font-medium">{t("invoices.printSignatures.review")}</h3>
                  {multiple && unsignedCount > 0 ? <p className="mt-1 text-xs text-foreground/80">
                    {t(`invoices.printSignatures.unsignedNote_${unsignedCount === 1 ? "one" : "other"}`, { count: unsignedCount })}{" "}
                    <button type="button" onClick={() => { setShowUnsigned((current) => !current); setPage(0); }} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
                      {t(showUnsigned ? "invoices.printSignatures.hideUnsigned" : "invoices.printSignatures.showUnsigned")}
                    </button>
                  </p> : null}
                  <div className="mt-2 hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-3 rounded-md border border-foreground/20 bg-muted px-3 py-2 text-xs font-semibold text-foreground sm:grid" aria-hidden>
                    <span>{t("invoices.printSignatures.invoice")}</span><span>{t("invoices.printSignatures.sender")}</span><span>{t("invoices.printSignatures.receiver")}</span>
                  </div>
                  {visibleRows.slice(first, first + PAGE_SIZE).map(({ row, index }) => (
                    <div key={row.invoiceId} className="grid gap-x-3 gap-y-1 border-b border-foreground/20 py-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:items-center sm:px-3">
                      <p className="break-words text-sm font-medium">{row.invoiceNumber}</p>
                      {row.senderSignature ? <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" {...state.form.register(`selections.${index}.includeSender`)} aria-label={t("invoices.printSignatures.includeSender", { number: row.invoiceNumber })} className="size-4 shrink-0 accent-primary" />
                        <span className="min-w-0 truncate"><span className="text-foreground/70 sm:hidden">{t("invoices.printSignatures.sender")}: </span>{row.senderSignature.signerName || t("invoices.printSignatures.sender")}</span>
                      </label> : <p className="flex min-h-11 items-center text-sm text-foreground/60">{t("invoices.printSignatures.noSender")}</p>}
                      {row.receiverSignatures.length ? <Controller control={state.form.control} name={`selections.${index}.receiverSignatureId`} render={({ field }) => (
                        <SearchableSelect
                          id={`print-receiver-${row.invoiceId}`}
                          options={receiverOptions(row)}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          disabled={state.busy}
                          placeholder={t("invoices.printSignatures.receiver")}
                          searchPlaceholder={t("invoices.printSignatures.searchReceivers")}
                          emptyMessage={t("invoices.printSignatures.noMatches")}
                          aria-label={t("invoices.printSignatures.receiverFor", { number: row.invoiceNumber })}
                          mobileSheet
                        />
                      )} /> : <p className="flex min-h-11 items-center text-sm text-foreground/60">{t("invoices.printSignatures.noReceivers")}</p>}
                    </div>
                  ))}
                  {pages > 1 ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/80">
                    <span>{t("invoices.printSignatures.range", { first: first + 1, last: Math.min(visibleRows.length, first + PAGE_SIZE), total: visibleRows.length })}</span>
                    <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={state.busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("invoices.printSignatures.previous")}</Button><span>{currentPage + 1} / {pages}</span><Button type="button" size="sm" variant="outline" disabled={state.busy || currentPage + 1 === pages} onClick={() => setPage(currentPage + 1)}>{t("invoices.printSignatures.next")}</Button></div>
                  </div> : null}
                </div>
              </>}
            </fieldset></div>
            {multiple && signedRows.length > 0 ? <div aria-live="polite" className="flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-foreground/20 bg-muted px-3 py-2 text-xs font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5"><UserCheck className="size-3.5 shrink-0" aria-hidden />{t("invoices.printSignatures.summarySender", { count: senderCount, total: rows.length })}</span>
              <span className="inline-flex items-center gap-1.5"><PenLine className="size-3.5 shrink-0" aria-hidden />{t("invoices.printSignatures.summaryReceiver", { count: receiverCount, total: rows.length })}</span>
            </div> : null}
            {state.form.formState.errors.root?.message ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.root.message}</p> : null}
            {state.reportUrl ? <a href={state.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-medium">{t("invoices.printSignatures.openPdf")}</a> : null}
            <DialogFooter className="static border-t border-foreground/20 bg-card pt-4"><Button type="button" variant="outline" disabled={state.busy} onClick={onClose}>{t("invoices.printSignatures.cancel")}</Button><Button type="submit" disabled={state.busy || !ready}><Printer className="size-4" />{state.busy ? t("invoices.printSignatures.printing") : rows.length === 1 ? t("invoices.printSignatures.printSingle") : t("invoices.printSignatures.print", { count: rows.length })}</Button></DialogFooter>
          </form>}
        {!ready ? <DialogFooter className="static border-t border-foreground/20 bg-card pt-4"><Button type="button" variant="outline" onClick={onClose}>{t("invoices.printSignatures.cancel")}</Button></DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
