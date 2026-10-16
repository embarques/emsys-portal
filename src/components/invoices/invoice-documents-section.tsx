"use client";

import { useRef, useState } from "react";
import { LayoutGrid, List, Search, Upload } from "lucide-react";
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
import { useTranslation } from "@/lib/i18n";
import { getContainerLabelForInvoice } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

export function InvoiceDocumentsSection({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canUpload = hasPermission("canUpdateInvoice", "invoice");
  const canDelete = hasPermission("canDeleteInvoice", "invoice");
  const { query, documents, rename, remove, upload, uploads, uploading } =
    useInvoiceDocuments(invoice.invoiceId);
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
  const selected =
    documents.find((item) => item.id === selectedId && !item.deleting) ?? null;
  const items = sortDocuments(documents, search, sort);
  const hasContainer = Boolean(invoice.containerId?.trim());
  const allowUpload = canUpload && hasContainer && !uploading;
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t("invoices.documents.title")}{" "}
            <span className="text-sm text-muted-foreground">
              ({documents.length}
              {query.hasNextPage ? "+" : ""})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            {getContainerLabelForInvoice(invoice)} / {invoice.invoiceNumber}
          </p>
        </div>
        {canUpload ? (
          <Button
            onClick={() => input.current?.click()}
            disabled={!allowUpload}
          >
            <Upload className="mr-2 size-4" />
            {t("invoices.documents.upload")}
          </Button>
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
          selected && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-40 flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label={t("invoices.documents.search")}
                placeholder={t("invoices.documents.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              aria-label={t("invoices.documents.sort")}
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="rounded-md border bg-background px-2 text-sm"
            >
              <option value="newest">{t("invoices.documents.newest")}</option>
              <option value="name">{t("invoices.documents.name")}</option>
            </select>
            <Button
              size="icon"
              variant={view === "list" ? "secondary" : "outline"}
              aria-label={t("invoices.documents.list")}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="size-4" />
            </Button>
            <Button
              size="icon"
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
              className="w-full"
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
                "rounded-lg border-2 border-dashed p-6 text-center",
                dragging && "border-primary bg-primary/5",
              )}
            >
              <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
              <Button
                variant="link"
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-destructive">
                      {job.error === "size"
                        ? t("invoices.documents.formats")
                        : job.error}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
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
