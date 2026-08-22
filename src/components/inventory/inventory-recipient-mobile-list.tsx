"use client";

import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { InventoryRecipientMobileRow } from "@/components/inventory/inventory-recipient-mobile-row";
import { InventoryRecipientMobileSelectionToolbar } from "@/components/inventory/inventory-recipient-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";
import { useTranslation } from "@/lib/i18n";

type InventoryRecipientMobileListProps = {
  query: string;
  recipients: InventoryRecipient[];
  pageRows: InventoryRecipient[];
  selectedIds: string[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (recipient: InventoryRecipient) => void;
  onEdit: (recipient: InventoryRecipient) => void;
  onDelete: (recipient: InventoryRecipient | InventoryRecipient[]) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onAddRecipient: () => void;
};

export function InventoryRecipientMobileList({
  query,
  recipients,
  pageRows,
  selectedIds,
  isLoading,
  page,
  totalPages,
  onQueryChange,
  onPageChange,
  onOpen,
  onEdit,
  onDelete,
  onSelectedIdsChange,
  onAddRecipient,
}: InventoryRecipientMobileListProps) {
  const { t } = useTranslation();
  const selectedRecipients = recipients.filter((recipient) => selectedIds.includes(recipient.id));
  const selectionMode = selectedIds.length > 0;

  function toggleSelected(recipientId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, recipientId] : selectedIds.filter((id) => id !== recipientId));
  }

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("inventory.submenus.recipients")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("inventory.pages.recipients")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" onClick={onAddRecipient}>
          <Plus className="size-6" />
          <span className="sr-only">{t("inventory.actions.addRecipient")}</span>
        </Button>
      </div>

      <TableSearchInput
        value={query}
        onChange={(value) => {
          onQueryChange(value);
          onPageChange(1);
        }}
        placeholder={t("inventory.search.recipients")}
        inputClassName="h-14 rounded-2xl text-base"
      />

      <InventoryRecipientMobileSelectionToolbar
        selectedCount={selectedIds.length}
        canEdit={selectedIds.length === 1}
        onClear={() => onSelectedIdsChange([])}
        onEdit={() => {
          const recipient = selectedRecipients[0];
          if (recipient) onEdit(recipient);
        }}
        onDelete={() => onDelete(selectedRecipients)}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" />
          {t("common.actions.previous")}
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {t("common.pagination.pageOf", { current: page, total: totalPages })}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {t("common.actions.next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="rounded-3xl border border-border bg-card px-4 shadow-sm">
        {isLoading ? (
          <DirectoryTableLoader
            icon={Users}
            title={t("inventory.loading.recipients.title")}
            description={t("inventory.loading.recipients.description")}
            columns={[
              t("inventory.form.fields.recipientName"),
              t("inventory.columns.type"),
              t("inventory.columns.contact"),
            ]}
          />
        ) : pageRows.length > 0 ? (
          pageRows.map((recipient) => (
            <InventoryRecipientMobileRow
              key={recipient.id}
              recipient={recipient}
              selected={selectedIds.includes(recipient.id)}
              selectionMode={selectionMode}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleSelected={toggleSelected}
            />
          ))
        ) : (
          <p className="py-8 text-center text-muted-foreground">{t("inventory.empty.recipients")}</p>
        )}
      </div>
    </section>
  );
}
