"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { useTranslation } from "@/lib/i18n";
import { getItemStock } from "@/lib/inventory/mock-store";
import {
  createEmptyReceiptLine,
  type ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import type { InventoryItem } from "@/lib/inventory/types/catalog";

type InventoryReceiptFormProps = {
  items: InventoryItem[];
  submitLabel: string;
  onSubmit: (values: ReceiptFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function createEmptyReceiptForm(): ReceiptFormValues {
  return {
    receiptDate: new Date().toISOString().slice(0, 16),
    source: "",
    receivedBy: DEFAULT_CREATED_BY,
    notes: "",
    lines: [createEmptyReceiptLine()],
  };
}

export function InventoryReceiptForm({
  items,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryReceiptFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ReceiptFormValues>(createEmptyReceiptForm);
  const handleEnterNavigation = useFormEnterNavigation();

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: `${item.sku} — ${item.name}`,
        keywords: [item.sku, item.name],
      })),
    [items],
  );

  useEffect(() => {
    setValues(createEmptyReceiptForm());
  }, []);

  function updateLine(index: number, patch: Partial<ReceiptFormValues["lines"][number]>) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setValues((current) => ({ ...current, lines: [...current.lines, createEmptyReceiptLine()] }));
  }

  function removeLine(index: number) {
    setValues((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      ...values,
      receiptDate: new Date(values.receiptDate).toISOString(),
      lines: values.lines.filter((line) => line.itemId && line.quantity > 0),
    });
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection title={t("inventory.form.sections.header")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="receiptDate">{t("inventory.form.fields.receiptDate")}</Label>
              <Input
                id="receiptDate"
                type="datetime-local"
                value={values.receiptDate}
                onChange={(event) => setValues((current) => ({ ...current, receiptDate: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="receivedBy">{t("inventory.form.fields.receivedBy")}</Label>
              <Input
                id="receivedBy"
                value={values.receivedBy}
                onChange={(event) => setValues((current) => ({ ...current, receivedBy: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="source">{t("inventory.form.fields.source")}</Label>
              <Input
                id="source"
                value={values.source}
                onChange={(event) => setValues((current) => ({ ...current, source: event.target.value }))}
                placeholder={t("inventory.form.placeholders.source")}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">{t("inventory.form.fields.notes")}</Label>
              <Input
                id="notes"
                value={values.notes}
                onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title={t("inventory.form.sections.lines")}>
          <div className="space-y-3">
            {values.lines.map((line, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <div className="space-y-1">
                  <Label>{t("inventory.form.fields.item")}</Label>
                  <SearchableSelect
                    value={line.itemId}
                    onValueChange={(next) => updateLine(index, { itemId: next })}
                    placeholder={t("inventory.form.fields.item")}
                    searchPlaceholder={t("inventory.search.items")}
                    options={itemOptions}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t("inventory.form.fields.quantity")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeLine(index)} aria-label={t("inventory.form.removeLine")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              {t("inventory.form.addLine")}
            </Button>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
