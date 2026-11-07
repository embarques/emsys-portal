"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { selectFormFieldTextOnFocus } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryMinor } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import { parseUsdToMinor, parseWholeQuantity } from "@/lib/inventory/utils/money";
import { cn } from "@/lib/utils";

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
  /** Extra classes for the lines wrapper (e.g. a scroll cap). */
  listClassName?: string;
  createLine: () => TLine;
  onChange: (lines: TLine[]) => void;
};

export function InventoryDocumentLinesEditor<TLine extends InventoryEditableLine>({
  idPrefix,
  lines,
  items,
  withUnitCost = false,
  availableByItem,
  listClassName,
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

  const showAvailable = availableByItem !== undefined && !withUnitCost;
  const wideColumns = withUnitCost
    ? "@xl:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_2.25rem]"
    : showAvailable
      ? "@xl:grid-cols-[minmax(0,1fr)_6rem_7rem_2.25rem]"
      : "@xl:grid-cols-[minmax(0,1fr)_7rem_2.25rem]";
  const headerClass = "text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn("hidden gap-2.5 px-0.5 @xl:grid", wideColumns)} aria-hidden>
        <span className={headerClass}>
          {t("inventory.form.fields.item")} <span className="text-destructive">*</span>
        </span>
        {showAvailable ? <span className={cn(headerClass, "text-right")}>{t("inventory.columns.available")}</span> : null}
        <span className={headerClass}>
          {t("inventory.form.fields.quantity")} <span className="text-destructive">*</span>
        </span>
        {withUnitCost ? (
          <>
            <span className={headerClass}>
              {t("inventory.form.fields.unitCost")} <span className="text-destructive">*</span>
            </span>
            <span className={cn(headerClass, "text-right")}>{t("inventory.form.fields.lineTotal")}</span>
          </>
        ) : null}
      </div>

      <div className={cn("-m-1 space-y-2.5 p-1", listClassName)}>
        {lines.map((line, index) => {
          const available = line.itemId ? availableByItem?.get(line.itemId) : undefined;
          const requested = parseWholeQuantity(line.quantity);
          const exceeds = available !== undefined && requested !== null && requested > available;
          const lineMinor =
            withUnitCost && requested !== null ? requested * (parseUsdToMinor(line.unitCost ?? "") ?? 0) : 0;

          return (
            <div
              key={line.key}
              role="group"
              aria-label={t("inventory.form.lineNumber", { number: index + 1 })}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 @xl:grid @xl:items-center @xl:gap-2.5 @xl:rounded-none @xl:border-0 @xl:bg-transparent @xl:p-0",
                wideColumns,
              )}
            >
              <div className="min-w-0">
                <SearchableSelect
                  id={`${idPrefix}-item-${line.key}`}
                  aria-label={t("inventory.form.fields.item")}
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
              </div>
              <div className="flex items-center gap-2 @xl:contents">
                {showAvailable ? (
                  <p
                    className={cn(
                      "min-w-0 flex-1 text-xs tabular-nums @xl:text-right @xl:text-sm",
                      exceeds ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {available === undefined ? (
                      <span className="hidden @xl:inline">—</span>
                    ) : (
                      <>
                        <span className="@xl:hidden">{t("inventory.form.availableAtSource", { count: available })}</span>
                        <span className="hidden @xl:inline">{available}</span>
                      </>
                    )}
                  </p>
                ) : null}
                <Input
                  id={`${idPrefix}-quantity-${line.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  aria-label={t("inventory.form.fields.quantity")}
                  placeholder={t("inventory.form.fields.quantity")}
                  className={cn("w-24 shrink-0 @xl:w-auto", !showAvailable && !withUnitCost && "ml-auto @xl:ml-0")}
                  value={line.quantity}
                  aria-invalid={exceeds || undefined}
                  onChange={(event) => patchLine(line.key, { quantity: event.target.value } as Partial<TLine>)}
                  onFocus={selectFormFieldTextOnFocus}
                  required
                />
                {withUnitCost ? (
                  <>
                    <Input
                      id={`${idPrefix}-cost-${line.key}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={t("inventory.form.fields.unitCost")}
                      className="w-28 shrink-0 @xl:w-auto"
                      value={line.unitCost ?? ""}
                      onChange={(event) => patchLine(line.key, { unitCost: event.target.value } as Partial<TLine>)}
                      onFocus={selectFormFieldTextOnFocus}
                      required
                    />
                    <p className="min-w-0 flex-1 text-right text-sm tabular-nums text-muted-foreground">
                      <span className="sr-only @xl:hidden">{t("inventory.form.fields.lineTotal")}: </span>
                      {formatInventoryMinor(lineMinor)}
                    </p>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length <= 1}
                  className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title={t("inventory.form.removeLine")}
                  aria-label={t("inventory.form.removeLine")}
                  onClick={() => onChange(lines.filter((entry) => entry.key !== line.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

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
