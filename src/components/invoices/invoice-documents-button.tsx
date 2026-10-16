"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { useTranslation } from "@/lib/i18n";
import { invoiceDocumentTabOptions } from "@/lib/invoices/documents-navigation";
import type { Invoice } from "@/lib/invoices/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

type Props = {
  invoice?: Invoice;
  selectedCount: number;
  onOpenMobile: (invoice: Invoice) => void;
};
export function InvoiceDocumentsButton({
  invoice,
  selectedCount,
  onOpenMobile,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { isDesktopTabs, openFormTab } = useWorkspaceTabs();
  const permission = PERMISSIONS.invoicesView;
  if (!hasPermission(permission.name, permission.resourceType)) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className={tableSelectionActionStyles.documents}
      disabled={selectedCount !== 1 || !invoice}
      onClick={() => {
        if (!invoice || selectedCount !== 1) return;
        if (isDesktopTabs) openFormTab(invoiceDocumentTabOptions(invoice));
        else onOpenMobile(invoice);
      }}
    >
      <FileText className="h-4 w-4" />
      {t("invoices.documents.title")}
    </Button>
  );
}
