"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LayoutGrid, List, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceDocumentList } from "@/components/invoices/invoice-document-list";
import { InvoiceDocumentPreview } from "@/components/invoices/invoice-document-preview";
import { InvoiceDocumentActions } from "@/components/invoices/invoice-document-actions";
import {
  DOCUMENT_ACCEPT,
  sortDocuments,
  type InvoiceDocument,
  type UploadItem,
} from "@/lib/invoices/documents";
import {
  downloadDocument,
  useInvoiceDocuments,
} from "@/lib/invoices/hooks/use-invoice-documents";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { useTranslation } from "@/lib/i18n";
import { getContainerLabelForInvoice } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

export function InvoiceDocumentsSection({
  invoice,
  initialFiles = [],
  onBusyChange,
  onUploadsComplete,
  compact = false,
}: {
  invoice: Pick<
    Invoice,
    "invoiceId" | "invoiceNumber" | "containerId" | "containerName"
  >;
  initialFiles?: File[];
  onBusyChange?: (busy: boolean) => void;
  onUploadsComplete?: () => void;
  /** Tighter header when embedded in the invoice wizard. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const isMobile = useIsMobileViewport();
  const canUpload = hasPermission("canUpdateInvoice", "invoice");
  const canDelete = hasPermission("canDeleteInvoice", "invoice");
  const { query, documents, rename, remove, upload, uploads, uploading } =
    useInvoiceDocuments(invoice.invoiceId);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && initialFiles.length && canUpload) {
      started.current = true;
      void upload(initialFiles);
    }
  }, [initialFiles, canUpload, upload]);
  useEffect(() => {
    onBusyChange?.(uploading || rename.isPending || remove.isPending);
  }, [uploading, rename.isPending, remove.isPending, onBusyChange]);
  const completed = useRef(false);
  useEffect(() => {
    if (
      !completed.current &&
      started.current &&
      !uploading &&
      uploads.length > 0 &&
      uploads.every((job) => job.status === "done")
    ) {
      completed.current = true;
      onUploadsComplete?.();
    }
  }, [uploading, uploads, onUploadsComplete]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<{
    mode: "rename" | "delete";
    document: InvoiceDocument;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const selected =
    documents.find((item) => item.id === selectedId && !item.deleting) ?? null;
  const items = sortDocuments(documents, search, sort);
  const hasContainer = Boolean(invoice.containerId?.trim());
  const allowUpload = canUpload && hasContainer && !uploading;
  const previewPresentation = isMobile ? "sheet" : "panel";

  async function download(document: InvoiceDocument) {
    setError(null);
    try {
      await downloadDocument(invoice.invoiceId, document);
    } catch {
      setError(t("invoices.documents.downloadError"));
    }
  }
  function startUpload(files: File[], retryJob?: UploadItem) {
    setError(null);
    if (allowUpload) void upload(files, retryJob);
  }
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
            {t("invoices.documents.title")}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({documents.length}
              {query.hasNextPage ? "+" : ""})
            </span>
          </h2>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              {getContainerLabelForInvoice(invoice)} / {invoice.invoiceNumber}
            </p>
          ) : null}
        </div>
        {canUpload ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => input.current?.click()}
              disabled={!allowUpload}
            >
              <Upload className="mr-2 size-4" />
              {t("invoices.documents.upload")}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full sm:hidden"
              onClick={() => cameraInput.current?.click()}
              disabled={!allowUpload}
            >
              <Camera className="mr-2 size-4" />
              {t("invoices.documents.takePhoto")}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div
        className={cn(
          "grid gap-4",
          selected && !isMobile && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 basis-full sm:min-w-40 sm:basis-auto">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label={t("invoices.documents.search")}
                placeholder={t("invoices.documents.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 pl-9"
              />
            </div>
            <select
              aria-label={t("invoices.documents.sort")}
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm sm:flex-none"
            >
              <option value="newest">{t("invoices.documents.newest")}</option>
              <option value="name">{t("invoices.documents.name")}</option>
            </select>
            <Button
              size="icon"
              className="size-11"
              variant={view === "list" ? "secondary" : "outline"}
              aria-label={t("invoices.documents.list")}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-11"
              variant={view === "grid" ? "secondary" : "outline"}
              aria-label={t("invoices.documents.grid")}
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
          {query.isPending ? (
            <p role="status" className="p-8 text-center text-sm">
              {t("invoices.documents.loading")}
            </p>
          ) : query.isError ? (
            <div role="alert" className="space-y-2 p-4 text-sm">
              <p>{t("invoices.documents.loadError")}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                {t("invoices.documents.retry")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              {t(
                search
                  ? "invoices.documents.noMatches"
                  : "invoices.documents.empty",
              )}
            </p>
          ) : (
            <InvoiceDocumentList
              invoiceId={invoice.invoiceId}
              items={items}
              selectedId={selectedId}
              view={view}
              canUpload={canUpload}
              canDelete={canDelete}
              onSelect={setSelectedId}
              onDownload={(document) => void download(document)}
              onAction={(mode, document) => {
                setError(null);
                setAction({ mode, document });
              }}
            />
          )}
          {query.hasNextPage ? (
            <Button
              variant="outline"
              className="min-h-11 w-full"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("invoices.documents.loadMore")}
            </Button>
          ) : null}
          {canUpload ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                if (allowUpload) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                startUpload(Array.from(event.dataTransfer.files));
              }}
              className={cn(
                "rounded-lg border-2 border-dashed p-4 text-center sm:p-6",
                dragging && "border-primary bg-primary/5",
              )}
            >
              <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
              <Button
                variant="link"
                className="h-auto min-h-11 max-w-full whitespace-normal"
                disabled={!allowUpload}
                onClick={() => input.current?.click()}
              >
                {t("invoices.documents.drop")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t(
                  hasContainer
                    ? "invoices.documents.formats"
                    : "invoices.documents.containerRequired",
                )}
              </p>
              <input
                ref={input}
                type="file"
                multiple
                accept={DOCUMENT_ACCEPT}
                className="sr-only"
                aria-label={t("invoices.documents.upload")}
                disabled={!allowUpload}
                onChange={(event) => {
                  startUpload(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
              <input
                ref={cameraInput}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="sr-only"
                aria-label={t("invoices.documents.takePhoto")}
                disabled={!allowUpload}
                onChange={(event) => {
                  startUpload(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </div>
          ) : null}
          <div aria-live="polite" className="space-y-2">
            {uploads.map((job) => (
              <div key={job.id} className="rounded border p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{job.file.name}</span>
                  <span>
                    {job.status === "failed"
                      ? t("invoices.documents.failed")
                      : job.status === "done"
                        ? t("invoices.documents.done")
                        : `${job.progress}%`}
                  </span>
                </div>
                <progress
                  value={job.progress}
                  max={100}
                  aria-label={job.file.name}
                  className="mt-2 h-1.5 w-full"
                />
                {job.status === "failed" ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-destructive">
                      {job.error === "size"
                        ? t("invoices.documents.formats")
                        : job.error}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 sm:min-h-8"
                      disabled={uploading}
                      onClick={() => startUpload([job.file], job)}
                    >
                      {t("invoices.documents.retry")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        {selected ? (
          <InvoiceDocumentPreview
            key={selected.id}
            invoiceId={invoice.invoiceId}
            document={selected}
            presentation={previewPresentation}
            onClose={() => setSelectedId(null)}
            onDownload={() => void download(selected)}
          />
        ) : null}
      </div>
      {action ? (
        <InvoiceDocumentActions
          key={`${action.mode}-${action.document.id}`}
          {...action}
          error={error}
          pending={rename.isPending || remove.isPending}
          onClose={() => setAction(null)}
          onConfirm={async (name) => {
            try {
              setError(null);
              if (action.mode === "rename") {
                if (name !== action.document.name)
                  await rename.mutateAsync({ document: action.document, name });
              } else {
                await remove.mutateAsync(action.document);
              }
              setAction(null);
            } catch {
              setError(t("invoices.documents.changeError"));
            }
          }}
        />
      ) : null}
    </section>
  );
}
