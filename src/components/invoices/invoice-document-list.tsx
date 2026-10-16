"use client";

import { FileAudio, FileText, FileVideo, ImageIcon, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceDocumentInfo } from "@/components/invoices/invoice-document-info";
import { InvoiceDocumentThumbnail } from "@/components/invoices/invoice-document-thumbnail";
import {
  documentActorName,
  formatDocumentSize,
  type InvoiceDocument,
} from "@/lib/invoices/documents";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  invoiceId: string;
  items: InvoiceDocument[];
  selectedId: string | null;
  view: "list" | "grid";
  canUpload: boolean;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onDownload: (document: InvoiceDocument) => void;
  onAction: (mode: "rename" | "delete", document: InvoiceDocument) => void;
};

export function InvoiceDocumentList({
  invoiceId,
  items,
  selectedId,
  view,
  canUpload,
  canDelete,
  onSelect,
  onDownload,
  onAction,
}: Props) {
  const { t } = useTranslation();
  function icon(document: InvoiceDocument) {
    if (document.mimeType.startsWith("image/")) {
      return <ImageIcon className="size-6 shrink-0 text-blue-500" />;
    }
    if (document.mimeType.startsWith("video/")) {
      return <FileVideo className="size-6 shrink-0 text-violet-500" />;
    }
    if (document.mimeType.startsWith("audio/")) {
      return <FileAudio className="size-6 shrink-0 text-amber-500" />;
    }
    return <FileText className="size-6 shrink-0 text-red-500" />;
  }
  function actions(document: InvoiceDocument) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("invoices.documents.actionsFor", {
              name: document.name,
            })}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={document.deleting}
            onSelect={() => onSelect(document.id)}
          >
            {t("invoices.documents.preview")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={document.deleting}
            onSelect={() => onDownload(document)}
          >
            {t("invoices.documents.download")}
          </DropdownMenuItem>
          {canUpload ? (
            <DropdownMenuItem
              disabled={document.deleting}
              onSelect={() => onAction("rename", document)}
            >
              {t("invoices.documents.rename")}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() => onAction("delete", document)}
            >
              {t(
                document.deleting
                  ? "invoices.documents.retryDelete"
                  : "invoices.documents.delete",
              )}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return view === "list" ? (
    <>
      <ul className="space-y-2 sm:hidden">
        {items.map((document) => (
          <li
            key={document.id}
            className={cn(
              "rounded-lg border p-3",
              selectedId === document.id && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:opacity-50"
                disabled={document.deleting}
                aria-label={document.name}
                onClick={() => onSelect(document.id)}
              >
                {icon(document)}
                <span className="min-w-0" aria-hidden>
                  <span className="block break-words text-sm font-medium">
                    {document.name}
                    {document.deleting
                      ? ` (${t("invoices.documents.deleting")})`
                      : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDocumentSize(document.size)}
                    {" · "}
                    {documentActorName(document.createdBy)}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center">
                <InvoiceDocumentInfo document={document} />
                {actions(document)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {["name", "uploadedBy", "uploaded", "size", "actions"].map(
                (column) => (
                  <th
                    key={column}
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 font-medium"
                  >
                    {t(`invoices.documents.${column}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((document) => (
              <tr
                key={document.id}
                className={cn(
                  "border-t",
                  selectedId === document.id && "bg-primary/5",
                )}
              >
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left hover:underline disabled:opacity-50"
                    disabled={document.deleting}
                    onClick={() => onSelect(document.id)}
                  >
                    {icon(document)}
                    <span className="max-w-56 break-words">
                      {document.name}
                      {document.deleting
                        ? ` (${t("invoices.documents.deleting")})`
                        : ""}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-3">
                  {documentActorName(document.createdBy)}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {formatAuditDateTime(document.createdAt || "") || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {formatDocumentSize(document.size)}
                </td>
                <td className="px-2">
                  <div className="flex items-center">
                    <InvoiceDocumentInfo document={document} />
                    {actions(document)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((document) => (
        <div
          key={document.id}
          className={cn(
            "min-w-0 rounded-lg border p-3",
            selectedId === document.id && "border-primary bg-primary/5",
          )}
        >
          <button
            type="button"
            className="flex w-full flex-col items-center gap-3 py-5 text-center text-sm hover:underline"
            disabled={document.deleting}
            onClick={() => onSelect(document.id)}
          >
            <InvoiceDocumentThumbnail
              invoiceId={invoiceId}
              document={document}
            />
            <span className="w-full truncate" title={document.name}>
              {document.name}
            </span>
          </button>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDocumentSize(document.size)}</span>
            <div className="flex items-center">
              <InvoiceDocumentInfo document={document} />
              {actions(document)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
