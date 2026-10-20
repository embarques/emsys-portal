"use client";

import { Warehouse } from "lucide-react";
import { useMemo, useState } from "react";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { InventoryHolderForm } from "@/components/inventory/inventory-holder-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { getHolderTypeLabel } from "@/lib/inventory/display";
import { useCreateInventoryHolder } from "@/lib/inventory/hooks/use-inventory";
import type { InventoryHolder, InventoryHolderFormValues, InventoryHolderType } from "@/lib/inventory/types/holders";

type InventoryHolderSelectProps = {
  id: string;
  label: string;
  value: string;
  holders: InventoryHolder[];
  allowedTypes: readonly InventoryHolderType[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  /** Holder IDs that cannot be chosen (e.g. the dispatch source). */
  excludeIds?: string[];
  onChange: (holderId: string) => void;
};

export function InventoryHolderSelect({
  id,
  label,
  value,
  holders,
  allowedTypes,
  placeholder,
  required = false,
  disabled = false,
  excludeIds = [],
  onChange,
}: InventoryHolderSelectProps) {
  const { t } = useTranslation();
  const createHolder = useCreateInventoryHolder();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<InventoryHolder | null>(null);

  const options = useMemo(() => {
    const visible = holders.filter(
      (holder) =>
        allowedTypes.includes(holder.type) &&
        !excludeIds.includes(holder.id) &&
        (holder.isActive || holder.id === value),
    );
    if (created && !visible.some((holder) => holder.id === created.id)) visible.push(created);
    return visible.map((holder) => ({
      value: holder.id,
      label: holder.displayName,
      description: getHolderTypeLabel(holder.type, t),
      keywords: [holder.type, holder.entityId],
    }));
  }, [allowedTypes, created, excludeIds, holders, t, value]);

  async function saveHolder(values: InventoryHolderFormValues) {
    try {
      setError(null);
      const holder = await createHolder.mutateAsync(values);
      setCreated(holder);
      onChange(holder.id);
      setDialogOpen(false);
    } catch (saveError) {
      setError(normalizeApiError(saveError).message);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label} {required ? <span className="text-destructive">*</span> : null}
        </Label>
        {!disabled ? (
          <FieldEntityActions
            onAdd={() => {
              setError(null);
              setDialogOpen(true);
            }}
            addIcon={Warehouse}
          />
        ) : null}
      </div>
      <SearchableSelect
        id={id}
        value={value}
        onValueChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={t("inventory.search.holders")}
        emptyMessage={t("inventory.empty.holders")}
        disabled={disabled}
        required={required}
        selectAllOnFocus
        mobileSheet
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.addHolderTitle")}</DialogTitle>
          </DialogHeader>
          {dialogOpen ? (
            <InventoryHolderForm
              allowedTypes={allowedTypes}
              isSubmitting={createHolder.isPending}
              externalError={error}
              onSubmit={saveHolder}
              onCancel={() => setDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
