"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";

import { InventoryRecipientForm } from "@/components/inventory/inventory-recipient-form";
import { InventoryRecipientViewSheet } from "@/components/inventory/inventory-recipient-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import { getRecipientTypeLabel } from "@/lib/inventory/display";
import {
  useCreateRecipient,
  useDeleteRecipients,
  useInventoryRecipients,
  useInventorySnapshotData,
  useUpdateRecipient,
} from "@/lib/inventory/hooks/use-inventory";
import {
  createEmptyRecipientForm,
  type InventoryRecipient,
  type RecipientFormValues,
} from "@/lib/inventory/types/recipients";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";

const PAGE_SIZE = 50;

export function InventoryRecipientsWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const { data: recipients = [], isLoading } = useInventoryRecipients();
  const snapshot = useInventorySnapshotData();
  const createRecipient = useCreateRecipient();
  const updateRecipient = useUpdateRecipient();
  const deleteRecipients = useDeleteRecipients();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<InventoryRecipient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryRecipient | InventoryRecipient[] | null>(null);
  const [viewRecipient, setViewRecipient] = useState<InventoryRecipient | null>(null);

  useTableSelectionReset(buildTableSelectionResetKey(query), setSelectedIds);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return recipients;
    return recipients.filter((recipient) =>
      [recipient.name, getRecipientTypeLabel(recipient.type, t), recipient.contactInfo ?? "", recipient.address ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, recipients, t]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));

  const columns: DataTableColumn<InventoryRecipient>[] = [
    { id: "name", label: t("inventory.form.fields.recipientName"), cellClassName: "font-medium", renderCell: (row) => row.name },
    { id: "type", label: t("inventory.columns.type"), renderCell: (row) => getRecipientTypeLabel(row.type, t) },
    { id: "contact", label: t("inventory.columns.contact"), renderCell: (row) => row.contactInfo ?? "—" },
    { id: "address", label: t("inventory.columns.address"), renderCell: (row) => row.address ?? "—" },
  ];

  const columnVisibility = useColumnVisibility("inventory-recipients", columns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(query.trim()),
    query,
    matched: filtered.length,
    catalogTotal: recipients.length,
    noun: t("inventory.submenus.recipients").toLowerCase(),
  });

  function recipientToFormValues(recipient: InventoryRecipient): RecipientFormValues {
    return {
      name: recipient.name,
      type: recipient.type,
      contactInfo: recipient.contactInfo ?? "",
      address: recipient.address ?? "",
    };
  }

  async function saveRecipient(values: RecipientFormValues) {
    try {
      if (formMode === "edit" && editingRecipient) {
        const updated = await updateRecipient.mutateAsync({ id: editingRecipient.id, values });
        notifyUpdated(t("inventory.submenus.recipients"), updated.name);
      } else {
        const created = await createRecipient.mutateAsync(values);
        notifyAdded(t("inventory.submenus.recipients"), created.name);
      }
      setFormMode(null);
      setEditingRecipient(null);
    } catch (error) {
      window.alert(toErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((row) => row.id) : [deleteTarget.id];
    await deleteRecipients.mutateAsync(ids);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewRecipient(null);
    notifyDeleted(t("inventory.submenus.recipients"), ids.length);
  }

  return (
    <div>
      <PageHeader
        title={t("inventory.submenus.recipients")}
        description={t("inventory.pages.recipients")}
        actions={
          <Button
            onClick={() => {
              setEditingRecipient(null);
              setFormMode("add");
            }}
          >
            <Plus className="h-4 w-4" />
            {t("inventory.actions.addRecipient")}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={false}
            onFiltersOpenChange={() => undefined}
            activeFilterCount={0}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t("inventory.search.recipients")}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRows.map((row) => row.id)}
          totalCount={filtered.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const recipient = pageRows.find((row) => row.id === selectedIds[0]);
            if (recipient) {
              setEditingRecipient(recipient);
              setFormMode("edit");
            }
          }}
          onDelete={() => setDeleteTarget(recipients.filter((row) => selectedIds.includes(row.id)))}
        />

        {isLoading ? (
          <DirectoryTableLoader
            icon={Users}
            title={t("inventory.loading.recipients.title")}
            description={t("inventory.loading.recipients.description")}
            columns={[t("inventory.form.fields.recipientName"), t("inventory.columns.type"), t("inventory.columns.contact")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.name}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedIds((current) => Array.from(new Set([...current, ...pageRows.map((row) => row.id)])));
              } else {
                setSelectedIds((current) => current.filter((id) => !pageRows.some((row) => row.id === id)));
              }
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));
            }}
            onRowClick={setViewRecipient}
            onRowDoubleClick={(recipient) => {
              setEditingRecipient(recipient);
              setFormMode("edit");
            }}
            activeRowId={viewRecipient?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.recipients")}</p>}
          />
        )}

        {!isLoading ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", { count: pageRows.length, total: filtered.length, noun: t("inventory.submenus.recipients").toLowerCase() })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>
                <ChevronLeft className="h-4 w-4" />
                {t("common.actions.previous")}
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)}>
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <InventoryRecipientViewSheet
        recipient={viewRecipient}
        snapshot={snapshot}
        open={Boolean(viewRecipient)}
        onOpenChange={(open) => !open && setViewRecipient(null)}
        onEdit={(recipient) => {
          setEditingRecipient(recipient);
          setFormMode("edit");
          setViewRecipient(null);
        }}
        onDelete={(recipient) => setDeleteTarget(recipient)}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {formMode === "edit" ? t("inventory.form.editRecipientTitle") : t("inventory.form.addRecipientTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventoryRecipientForm
            key={editingRecipient?.id ?? "new"}
            initialValues={editingRecipient ? recipientToFormValues(editingRecipient) : createEmptyRecipientForm()}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.addRecipient")}
            isSubmitting={createRecipient.isPending || updateRecipient.isPending}
            onSubmit={saveRecipient}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.delete.recipientsTitle")}</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("inventory.delete.recipientsDescription", { count: deleteTarget.length })
                : t("inventory.delete.itemDescription", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={deleteRecipients.isPending} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
