"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { useTranslation } from "@/lib/i18n";
import type { Invoice } from "@/lib/invoices/types";

type Props = {
  invoice?: Invoice;
  selectedCount: number;
  /** Opens the invoice view on the Documents tab. */
  onOpen: (invoice: Invoice) => void;
};

export function InvoiceDocumentsButton({
  invoice,
  selectedCount,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
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
        onOpen(invoice);
      }}
    >
      <FileText className="h-4 w-4" />
      {t("invoices.view.actions.manageDocuments")}
    </Button>
  );
}
