"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceDocumentsSection } from "@/components/invoices/invoice-documents-section";
import { useInvoice } from "@/lib/invoices/hooks/use-invoices";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import {
  useWorkspaceTabs,
  useUpdateWorkspaceTabLabel,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function InvoiceDocumentsWorkspace({
  tabId,
  entityId,
}: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const permission = PERMISSIONS.invoicesView;
  const allowed = hasPermission(permission.name, permission.resourceType);
  const invoice = useInvoice(entityId ?? null, allowed);
  const updateLabel = useUpdateWorkspaceTabLabel();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  useEffect(() => {
    if (invoice.data) updateLabel(tabId, invoice.data.invoiceNumber);
  }, [invoice.data, tabId, updateLabel]);
  if (!allowed)
    return <p role="alert">{t("invoices.documents.accessDenied")}</p>;
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Button variant="ghost" onClick={() => closeFormTabAndReturn(tabId)}>
        <ArrowLeft className="size-4" />
        {t("invoices.documents.backToInvoices")}
      </Button>
      {invoice.isPending ? (
        <p role="status">{t("invoices.documents.loading")}</p>
      ) : invoice.isError || !invoice.data ? (
        <div role="alert" className="space-y-3 rounded-lg border p-6">
          <p>{t("invoices.documents.loadError")}</p>
          <Button variant="outline" onClick={() => void invoice.refetch()}>
            {t("invoices.documents.retry")}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <InvoiceDocumentsSection
            key={invoice.data.invoiceId}
            invoice={invoice.data}
          />
        </div>
      )}
    </div>
  );
}
