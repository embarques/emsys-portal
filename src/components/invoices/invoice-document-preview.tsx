"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";
import {
  canPreviewDocument,
  type InvoiceDocument,
} from "@/lib/invoices/documents";
import { useInvoiceDocumentLink } from "@/lib/invoices/hooks/use-invoice-documents";
import { cn } from "@/lib/utils";

type Props = {
  invoiceId: string;
  document: InvoiceDocument;
  onClose: () => void;
  onDownload: () => void;
  /** Full-screen sheet on small viewports; inline panel otherwise. */
  presentation?: "panel" | "sheet";
};

function PreviewBody({
  invoiceId,
  document,
  onDownload,
  className,
}: {
  invoiceId: string;
  document: InvoiceDocument;
  onDownload: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const link = useInvoiceDocumentLink(invoiceId, document);
  const [mediaFailed, setMediaFailed] = useState(false);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="relative flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded border bg-background sm:min-h-80">
        {link.isPending ? (
          <p role="status" className="p-4 text-sm">
            {t("invoices.documents.loading")}
          </p>
        ) : link.isError ? (
          <div role="alert" className="space-y-2 p-4 text-sm">
            <p>{t("invoices.documents.previewError")}</p>
            <Button variant="outline" onClick={() => void link.refetch()}>
              {t("invoices.documents.retry")}
            </Button>
          </div>
        ) : !canPreviewDocument(document.mimeType) || mediaFailed ? (
          <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto size-12" />
            <p>{t("invoices.documents.noPreview")}</p>
          </div>
        ) : document.mimeType === "application/pdf" ? (
          <iframe
            title={document.name}
            src={link.data?.url}
            className="h-[min(70dvh,36rem)] min-h-64 w-full sm:min-h-80"
            referrerPolicy="no-referrer"
          />
        ) : document.mimeType.startsWith("video/") ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={link.data?.url}
            aria-label={document.name}
            className="max-h-[min(70dvh,36rem)] w-full"
            onError={() => setMediaFailed(true)}
          />
        ) : document.mimeType.startsWith("audio/") ? (
          <audio
            controls
            preload="metadata"
            src={link.data?.url}
            aria-label={document.name}
            className="w-full min-w-0 px-3"
            onError={() => setMediaFailed(true)}
          />
        ) : link.data ? (
          <Image
            src={link.data.url}
            alt={document.name}
            width={900}
            height={1200}
            unoptimized
            className="max-h-[min(70dvh,36rem)] w-full object-contain"
            onError={() => setMediaFailed(true)}
          />
        ) : null}
      </div>
      <Button
        variant="outline"
        className="mt-3 min-h-11 w-full"
        onClick={onDownload}
        disabled={document.deleting}
      >
        <Download className="mr-2 size-4" />
        {t("invoices.documents.download")}
      </Button>
    </div>
  );
}

export function InvoiceDocumentPreview({
  invoiceId,
  document,
  onClose,
  onDownload,
  presentation = "panel",
}: Props) {
  const { t } = useTranslation();

  if (presentation === "sheet") {
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[min(92dvh,100%)] flex-col gap-0 p-0"
        >
          <SheetHeader className="shrink-0 border-b px-4 py-3 text-left">
            <SheetTitle className="truncate pr-8" title={document.name}>
              {document.name}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <PreviewBody
              invoiceId={invoiceId}
              document={document}
              onDownload={onDownload}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

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
          className="size-11 shrink-0"
          onClick={onClose}
          aria-label={t("invoices.documents.closePreview")}
        >
          <X className="size-4" />
        </Button>
      </div>
      <PreviewBody
        invoiceId={invoiceId}
        document={document}
        onDownload={onDownload}
      />
    </aside>
  );
}
