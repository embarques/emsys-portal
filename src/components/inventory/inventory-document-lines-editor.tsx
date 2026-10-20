"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { selectFormFieldTextOnFocus } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryMinor } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import { parseUsdToMinor, parseWholeQuantity } from "@/lib/inventory/utils/money";

export type InventoryEditableLine = {
  key: string;
  itemId: string;
  quantity: string;
  unitCost?: string;
};

type InventoryDocumentLinesEditorProps<TLine extends InventoryEditableLine> = {
  idPrefix: string;
  lines: TLine[];
  items: InventoryItem[];
  /** Receipts carry a unit cost per line; dispatches only move quantities. */
  withUnitCost?: boolean;
  /** Available quantity at the source holder, shown per line when provided. */
  availableByItem?: Map<string, number>;
  createLine: () => TLine;
  onChange: (lines: TLine[]) => void;
};

export function InventoryDocumentLinesEditor<TLine extends InventoryEditableLine>({
  idPrefix,
  lines,
  items,
  withUnitCost = false,
  availableByItem,
  createLine,
  onChange,
}: InventoryDocumentLinesEditorProps<TLine>) {
  const { t } = useTranslation();

  const itemOptions = useMemo(
    () =>
      items
        .filter((item) => item.isActive || lines.some((line) => line.itemId === item.id))
        .map((item) => ({
          value: item.id,
          label: item.name,
          description: [item.sku, item.unitOfMeasure].filter(Boolean).join(" · ") || undefined,
          keywords: [item.sku, item.category],
        })),
    [items, lines],
  );

  const totalMinor = withUnitCost
    ? lines.reduce((sum, line) => {
        const quantity = parseWholeQuantity(line.quantity) ?? 0;
        const unitCost = parseUsdToMinor(line.unitCost ?? "") ?? 0;
        return sum + quantity * unitCost;
      }, 0)
    : 0;
  const totalQuantity = lines.reduce((sum, line) => sum + (parseWholeQuantity(line.quantity) ?? 0), 0);

  function patchLine(key: string, patch: Partial<TLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const available = line.itemId ? availableByItem?.get(line.itemId) : undefined;
        const requested = parseWholeQuantity(line.quantity);
        const exceeds = available !== undefined && requested !== null && requested > available;
        const lineMinor =
          withUnitCost && requested !== null ? requested * (parseUsdToMinor(line.unitCost ?? "") ?? 0) : null;

        return (
          <fieldset
            key={line.key}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] @3xl:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
          >
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              {t("inventory.form.lineNumber", { number: index + 1 })}
            </legend>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`${idPrefix}-item-${line.key}`}>
                {t("inventory.form.fields.item")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id={`${idPrefix}-item-${line.key}`}
                value={line.itemId}
                onValueChange={(itemId) => patchLine(line.key, { itemId } as Partial<TLine>)}
                options={itemOptions}
                placeholder={t("inventory.form.placeholders.item")}
                searchPlaceholder={t("inventory.search.items")}
                emptyMessage={t("inventory.empty.noOptions")}
                selectAllOnFocus
                required
                mobileSheet
              />
              {available !== undefined ? (
                <p className={exceeds ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {t("inventory.form.availableAtSource", { count: available })}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-quantity-${line.key}`}>
                {t("inventory.form.fields.quantity")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${idPrefix}-quantity-${line.key}`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={line.quantity}
                aria-invalid={exceeds || undefined}
                onChange={(event) => patchLine(line.key, { quantity: event.target.value } as Partial<TLine>)}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
            {withUnitCost ? (
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-cost-${line.key}`}>
                  {t("inventory.form.fields.unitCost")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`${idPrefix}-cost-${line.key}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={line.unitCost ?? ""}
                  onChange={(event) => patchLine(line.key, { unitCost: event.target.value } as Partial<TLine>)}
                  onFocus={selectFormFieldTextOnFocus}
                  required
                />
                {lineMinor !== null ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("inventory.form.fields.lineTotal")}: {formatInventoryMinor(lineMinor)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={lines.length <= 1}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={t("inventory.form.removeLine")}
                aria-label={t("inventory.form.removeLine")}
                onClick={() => onChange(lines.filter((entry) => entry.key !== line.key))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => onChange([...lines, createLine()])}
        >
          <Plus className="size-4" />
          {t("inventory.form.addLine")}
        </Button>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("inventory.form.totalQuantity", { count: totalQuantity })}
          {withUnitCost ? ` · ${t("inventory.form.totalCost")}: ${formatInventoryMinor(totalMinor)}` : ""}
        </p>
      </div>
    </div>
  );
}
