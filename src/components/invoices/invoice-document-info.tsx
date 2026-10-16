"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  documentActorName,
  formatDocumentSize,
  type InvoiceDocument,
} from "@/lib/invoices/documents";
import { useTranslation } from "@/lib/i18n";

export function InvoiceDocumentInfo({
  document,
}: {
  document: InvoiceDocument;
}) {
  const { t, locale } = useTranslation();
  const modified = Boolean(
    document.updatedBy ||
    (document.updatedAt && document.updatedAt !== document.createdAt),
  );
  const fields = [
    ["name", document.name],
    ["originalName", document.originalName || document.name],
    ["fileType", document.mimeType.split("/").pop()?.toUpperCase() || "—"],
    [
      "size",
      `${formatDocumentSize(document.size)} (${document.size.toLocaleString(locale)} ${t("invoices.documents.bytes")})`,
    ],
    ["uploaded", formatAuditDateTime(document.createdAt || "")],
    ["uploadedBy", documentActorName(document.createdBy)],
    ...(modified
      ? [
          ["updated", formatAuditDateTime(document.updatedAt || "")],
          ["updatedBy", documentActorName(document.updatedBy)],
        ]
      : []),
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
          aria-label={t("invoices.documents.infoFor", { name: document.name })}
          title={t("invoices.documents.info")}
        >
          <Info className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("invoices.documents.info")}</DialogTitle>
          <DialogDescription className="break-words">
            {document.name}
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y">
          {fields.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 py-3 text-sm"
            >
              <dt className="text-muted-foreground">
                {t(`invoices.documents.${label}`)}
              </dt>
              <dd className="min-w-0 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
