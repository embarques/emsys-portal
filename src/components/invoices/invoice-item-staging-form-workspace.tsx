"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { InvoiceStagingWorkflow } from "@/components/invoices/invoice-staging-dialog";
import { Button } from "@/components/ui/button";
import { fetchInvoiceById } from "@/lib/invoices/api/invoices-api";
import { decodeStagingInvoiceIds } from "@/lib/invoices/staging";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { queryKeys } from "@/lib/query/query-keys";

export function InvoiceItemStagingFormWorkspace({ tabId, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const invoiceIds = useMemo(() => decodeStagingInvoiceIds(entityId), [entityId]);

  const invoiceQueries = useQueries({
    queries: invoiceIds.map((invoiceId) => ({
      queryKey: queryKeys.invoices.detail(invoiceId),
      queryFn: () => fetchInvoiceById(invoiceId),
      enabled: Boolean(invoiceId),
    })),
  });

  const invoices = useMemo(
    () =>
      invoiceQueries
        .map((query) => query.data)
        .filter((invoice): invoice is Invoice => invoice != null),
    [invoiceQueries],
  );

  const isLoading = invoiceQueries.some((query) => query.isLoading);
  const isError = invoiceQueries.some((query) => query.isError);

  function handleClose() {
    closeFormTabAndReturn(tabId);
  }

  if (invoiceIds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
        Select invoices in the table, then open manage invoice items again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading selected invoices…
      </div>
    );
  }

  if (isError || invoices.length === 0) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed p-8">
        <p className="text-sm text-muted-foreground">
          Unable to load the selected invoices for label processing.
        </p>
        <Button variant="outline" onClick={handleClose}>
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Button>
      </div>
    );
  }

  return (
    <InvoiceStagingWorkflow
      presentation="page"
      invoices={invoices}
      onClose={handleClose}
      title={t("invoices.staging.title")}
    />
  );
}
