"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  canPreviewDocument,
  type InvoiceDocument,
} from "@/lib/invoices/documents";
import { useInvoiceDocumentLink } from "@/lib/invoices/hooks/use-invoice-documents";

type Props = {
  invoiceId: string;
  document: InvoiceDocument;
  onClose: () => void;
  onDownload: () => void;
};
export function InvoiceDocumentPreview({
  invoiceId,
  document,
  onClose,
  onDownload,
}: Props) {
  const { t } = useTranslation();
  const link = useInvoiceDocumentLink(invoiceId, document);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <aside
      aria-label={t("invoices.documents.preview")}
      className="flex min-w-0 flex-col rounded-lg border bg-muted/20 p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold" title={document.name}>
          {document.name}
        </h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label={t("invoices.documents.closePreview")}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="relative flex min-h-80 flex-1 items-center justify-center overflow-hidden rounded border bg-background">
        {link.isPending ? (
          <p role="status" className="p-4 text-sm">
            {t("invoices.documents.loading")}
          </p>
        ) : link.isError ? (
          <div role="alert" className="p-4 text-sm">
            <p>{t("invoices.documents.previewError")}</p>
            <Button variant="outline" onClick={() => void link.refetch()}>
              {t("invoices.documents.retry")}
            </Button>
          </div>
        ) : !canPreviewDocument(document.mimeType) || imageFailed ? (
          <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto size-12" />
            <p>{t("invoices.documents.noPreview")}</p>
          </div>
        ) : document.mimeType === "application/pdf" ? (
          <iframe
            title={document.name}
            src={link.data?.url}
            className="h-[60vh] min-h-80 w-full"
            referrerPolicy="no-referrer"
          />
        ) : link.data ? (
          <Image
            src={link.data.url}
            alt={document.name}
            width={900}
            height={1200}
            unoptimized
            className="max-h-[60vh] w-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </div>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={onDownload}
        disabled={document.deleting}
      >
        <Download className="mr-2 size-4" />
        {t("invoices.documents.download")}
      </Button>
    </aside>
  );
}
