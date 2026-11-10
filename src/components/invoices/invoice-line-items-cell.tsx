"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { RecordViewSheet, RecordViewSheetBody, RecordViewSheetContent, RecordViewSheetHeader } from "@/components/app-shell/record-view-sheet";
import { InvoiceLineItemsSection } from "@/components/invoices/invoice-line-items-section";
import { Button } from "@/components/ui/button";
import { SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeApiError } from "@/lib/api/api-error";
import { formatInvoiceTableLineItemsSummary } from "@/lib/invoices/display";
import { useInvoiceLineItems } from "@/lib/invoices/hooks/use-invoice-line-items";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

function InvoiceLineItemsSheet({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const query = useInvoiceLineItems(invoice.invoiceId);
  return (
    <RecordViewSheetContent>
      <RecordViewSheetHeader
        title={t("invoices.view.lineItems.title")}
        description={t("invoices.view.lineItems.invoice", { number: invoice.invoiceNumber || t("common.empty.dash") })}
      />
      <RecordViewSheetBody>
        {query.isError ? (
          <div role="alert" className="space-y-3 px-4 py-5 text-sm">
            <p className="text-destructive">{normalizeApiError(query.error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className="size-4" />
              {t("common.actions.retry")}
            </Button>
          </div>
        ) : null}
        {query.data ? (
          <InvoiceLineItemsSection lineItems={query.data.lineItems} />
        ) : !query.isError ? (
          <div role="status" className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("invoices.view.lineItems.loading")}
          </div>
        ) : null}
      </RecordViewSheetBody>
    </RecordViewSheetContent>
  );
}

function InvoiceLineItemsCellContent({ invoice, canView }: { invoice: Invoice; canView: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const summary = formatInvoiceTableLineItemsSummary(invoice, t);
  return (
    <div className="min-w-0" onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <RecordViewSheet open={open && canView} onOpenChange={setOpen}>
        <p className="truncate" title={summary}>{summary}</p>
        {canView ? (
          <SheetTrigger asChild>
            <button type="button" className="mt-0.5 text-left text-xs font-medium text-primary hover:underline"
              aria-label={t("invoices.view.lineItems.viewForInvoice", { number: invoice.invoiceNumber || t("common.empty.dash") })}>
              {t("invoices.view.lineItems.view")}
            </button>
          </SheetTrigger>
        ) : null}
        {open && canView ? <InvoiceLineItemsSheet invoice={invoice} /> : null}
      </RecordViewSheet>
    </div>
  );
}

export function InvoiceLineItemsCell({ invoice }: { invoice: Invoice }) {
  const { companyId, user, email, roleId, hasPermission } = useAuth();
  const permission = PERMISSIONS.invoicesView;
  return <InvoiceLineItemsCellContent
    key={JSON.stringify([invoice.invoiceId, companyId, user?.uid || email || "", roleId])}
    invoice={invoice}
    canView={hasPermission(permission.name, permission.resourceType)}
  />;
}
