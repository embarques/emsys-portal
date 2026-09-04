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
import { getRecipientTypeLabel } from "@/lib/inventory/display";
import { getItemStock } from "@/lib/inventory/mock-store";
import {
  createEmptyDispatchLine,
  type DispatchFormValues,
} from "@/lib/inventory/types/documents";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventoryRecipient } from "@/lib/inventory/types/recipients";

type InventoryDispatchFormProps = {
  items: InventoryItem[];
  recipients: InventoryRecipient[];
  submitLabel: string;
  secondarySubmitLabel?: string;
  onSubmit: (values: DispatchFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function createEmptyDispatchForm(): DispatchFormValues {
  return {
    dispatchDate: new Date().toISOString().slice(0, 16),
    recipientId: "",
    dispatchedBy: DEFAULT_CREATED_BY,
    invoiceNumber: "",
    notes: "",
    lines: [createEmptyDispatchLine()],
    markSent: false,
  };
}

export function InventoryDispatchForm({
  items,
  recipients,
  submitLabel,
  secondarySubmitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryDispatchFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<DispatchFormValues>(createEmptyDispatchForm);
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

  const recipientOptions = useMemo(
    () =>
      recipients.map((recipient) => ({
        value: recipient.id,
        label: recipient.name,
        description: getRecipientTypeLabel(recipient.type, t),
      })),
    [recipients, t],
  );

  useEffect(() => {
    setValues(createEmptyDispatchForm());
  }, []);

  function updateLine(index: number, patch: Partial<DispatchFormValues["lines"][number]>) {
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setValues((current) => ({ ...current, lines: [...current.lines, createEmptyDispatchLine()] }));
  }

  function removeLine(index: number) {
    setValues((current) => ({
      ...current,
      lines: current.lines.length > 1 ? current.lines.filter((_, lineIndex) => lineIndex !== index) : current.lines,
    }));
  }

  function handleSubmit(event: React.FormEvent, markSent: boolean) {
    event.preventDefault();
    onSubmit({
      ...values,
      dispatchDate: new Date(values.dispatchDate).toISOString(),
      markSent,
      lines: values.lines.filter((line) => line.itemId && line.quantity > 0),
    });
  }

  return (
    <form onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection title={t("inventory.form.sections.header")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dispatchDate">{t("inventory.form.fields.dispatchDate")}</Label>
              <Input
                id="dispatchDate"
                type="datetime-local"
                value={values.dispatchDate}
                onChange={(event) => setValues((current) => ({ ...current, dispatchDate: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispatchedBy">{t("inventory.form.fields.dispatchedBy")}</Label>
              <Input
                id="dispatchedBy"
                value={values.dispatchedBy}
                onChange={(event) => setValues((current) => ({ ...current, dispatchedBy: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="recipientId">{t("inventory.form.fields.recipient")}</Label>
              <SearchableSelect
                id="recipientId"
                value={values.recipientId}
                onValueChange={(next) => setValues((current) => ({ ...current, recipientId: next }))}
                placeholder={t("inventory.form.fields.recipient")}
                searchPlaceholder={t("inventory.search.recipients")}
                options={recipientOptions}
                mobileSheet
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="invoiceNumber">{t("inventory.form.fields.invoiceNumber")}</Label>
              <Input
                id="invoiceNumber"
                value={values.invoiceNumber}
                onChange={(event) => setValues((current) => ({ ...current, invoiceNumber: event.target.value }))}
                placeholder={t("inventory.form.placeholders.invoiceNumber")}
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
            {values.lines.map((line, index) => {
              const available = line.itemId ? getItemStock(line.itemId) : 0;
              const item = items.find((entry) => entry.id === line.itemId);
              return (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label>{t("inventory.form.fields.item")}</Label>
                    <SearchableSelect
                      value={line.itemId}
                      onValueChange={(next) => updateLine(index, { itemId: next })}
                      placeholder={t("inventory.form.fields.item")}
                      searchPlaceholder={t("inventory.search.items")}
                      options={itemOptions}
                      mobileSheet
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
                  <div className="space-y-1">
                    <Label>{t("inventory.form.fields.availableStock")}</Label>
                    <Input readOnly value={line.itemId ? `${available} ${item?.unit ?? ""}` : "—"} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-12 rounded-xl sm:size-9"
                    onClick={() => removeLine(index)}
                    aria-label={t("inventory.form.removeLine")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" className="h-12 rounded-xl sm:h-9" onClick={addLine}>
              <Plus className="h-4 w-4" />
              {t("inventory.form.addLine")}
            </Button>
          </div>
        </FormSection>
      </FormBody>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button type="button" variant="outline" className="h-12 rounded-xl sm:h-9" onClick={onCancel} disabled={isSubmitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl sm:h-9"
          disabled={isSubmitting}
          onClick={(event) => handleSubmit(event, false)}
        >
          {isSubmitting ? t("common.actions.saving") : submitLabel}
        </Button>
        {secondarySubmitLabel ? (
          <Button
            type="button"
            className="h-12 rounded-xl sm:h-9"
            disabled={isSubmitting}
            onClick={(event) => handleSubmit(event, true)}
          >
            {isSubmitting ? t("common.actions.saving") : secondarySubmitLabel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
