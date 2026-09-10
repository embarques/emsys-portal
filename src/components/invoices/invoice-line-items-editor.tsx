"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvoiceLineItemDescriptionCombobox } from "@/components/invoices/invoice-line-item-description-combobox";
import { wizardInputFieldProps } from "@/components/invoices/invoice-wizard-styles";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  commitInvoiceLineItemWithUniqueDescription,
  findInvoiceLineItemWithDescription,
} from "@/lib/invoices/merge-duplicate-line-item";
import {
  computeLineTotal,
  createEmptyInvoiceLineItem,
  hasInvoiceLineItemContent,
  hasPositiveInvoiceLineItemQuantity,
  resolveLineLabelCount,
  resolveLineTotal,
  type InvoiceLineItemFormValues,
} from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { Item } from "@/lib/items/types";
import { cn } from "@/lib/utils";

type InvoiceLineItemsEditorProps = {
  lineItems: InvoiceLineItemFormValues[];
  catalogItems: Item[];
  appearance?: "default" | "wizard" | "phoneWizard";
  onChange: (lineItems: InvoiceLineItemFormValues[]) => void;
  requestFocusKey?: number;
};

type LineItemFieldHandlers = {
  onUpdate: (patch: Partial<InvoiceLineItemFormValues>) => void;
  onChangeDescription: (itemName: string) => void;
  onLoadCatalogItem: (catalogItem: Item) => void;
  onChangeQuantity: (quantity: string) => void;
  onChangeUnitPrice: (unitPrice: string) => void;
  onChangeTotal: (total: string) => void;
};

type LineItemEntryFieldsProps = {
  item: InvoiceLineItemFormValues;
  catalogItems: Item[];
  inputClass: (value: string) => ReturnType<typeof wizardInputFieldProps> | { className?: undefined };
  labelClass?: string;
  isPhoneWizard?: boolean;
  descriptionPlaceholder: string;
  descriptionLabel: string;
  quantityLabel: string;
  quantityRequiredMessage: string;
  labelsLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  autoFocusDescription?: boolean;
  onDescriptionFocused?: () => void;
  onCommitFromTotal: () => void;
} & LineItemFieldHandlers;

type SortableLineItemRowProps = {
  item: InvoiceLineItemFormValues;
  index: number;
  lineItemCount: number;
  isWizard: boolean;
  inputClass?: (value: string) => ReturnType<typeof wizardInputFieldProps> | { className?: undefined };
  labelClass?: string;
  catalogItems: Item[];
  descriptionPlaceholder: string;
  descriptionLabel: string;
  quantityLabel: string;
  quantityRequiredMessage: string;
  labelsLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  deleteLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  dragToReorderLabel: string;
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<InvoiceLineItemFormValues>) => void;
  onChangeDescription: (index: number, itemName: string) => void;
  onLoadCatalogItem: (index: number, catalogItem: Item) => void;
  onChangeQuantity: (index: number, quantity: string) => void;
  onChangeUnitPrice: (index: number, unitPrice: string) => void;
  onChangeTotal: (index: number, total: string) => void;
  deriveTotalString: (item: InvoiceLineItemFormValues) => string;
  autoFocusDescription?: boolean;
  onDescriptionFocused?: () => void;
  onCommitFromTotal: () => void;
};

type WizardLineItemsTableProps = {
  items: InvoiceLineItemFormValues[];
  editingId: string | null;
  descriptionColumn: string;
  quantityColumn: string;
  labelsColumn: string;
  unitPriceColumn: string;
  totalColumn: string;
  actionsColumn: string;
  emptyMessage: string;
  editLabel: string;
  deleteLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
};

type WizardLineItemsMobileCardsProps = WizardLineItemsTableProps;

/** Move keyboard focus to a sibling field within the same line item row. */
function focusFieldById(fieldId: string) {
  const element = document.getElementById(fieldId) as HTMLInputElement | null;
  if (!element) return;
  element.focus();
  // Number inputs often ignore select() in the same turn as focus.
  window.requestAnimationFrame(() => {
    element.select?.();
  });
}

/** Blank unit price is 0 so a free line can be committed without typing a price. */
function resolveUnitPriceInput(unitPrice: string): string {
  return unitPrice.trim() === "" ? "0" : unitPrice;
}

/** Default total tracks unit price × quantity until the user overrides it. */
function deriveTotalString(item: InvoiceLineItemFormValues): string {
  const quantity = Number(item.quantity);
  const unitPrice = Number(resolveUnitPriceInput(item.unitPrice));
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return "";
  return computeLineTotal(quantity, unitPrice).toFixed(2);
}

function finalizeLineItemDraft(item: InvoiceLineItemFormValues): InvoiceLineItemFormValues {
  const unitPrice = resolveUnitPriceInput(item.unitPrice);
  const withPrice = { ...item, unitPrice };
  const labelsValue = item.labelsManual ? item.labelCount : item.quantity;
  const totalValue = item.totalManual ? item.lineTotal : deriveTotalString(withPrice);

  return {
    ...withPrice,
    labelCount: labelsValue,
    lineTotal: totalValue,
  };
}

function isDraftReadyToCommit(item: InvoiceLineItemFormValues): boolean {
  const unitPrice = Number(resolveUnitPriceInput(item.unitPrice));
  return Boolean(
    item.itemName.trim() &&
      hasPositiveInvoiceLineItemQuantity(item) &&
      Number.isFinite(unitPrice) &&
      unitPrice >= 0,
  );
}

function quantityFieldError(
  item: InvoiceLineItemFormValues,
  message: string,
): string | null {
  if (!item.quantity.trim() || hasPositiveInvoiceLineItemQuantity(item)) return null;
  return message;
}

function buildQuantityPatch(
  item: InvoiceLineItemFormValues,
  quantity: string,
): Partial<InvoiceLineItemFormValues> {
  const patch: Partial<InvoiceLineItemFormValues> = { quantity };

  if (!item.labelsManual) patch.labelCount = quantity;
  if (!item.totalManual) {
    patch.lineTotal = deriveTotalString({ ...item, quantity });
  }

  return patch;
}

function buildUnitPricePatch(
  item: InvoiceLineItemFormValues,
  unitPrice: string,
): Partial<InvoiceLineItemFormValues> {
  return {
    unitPrice,
    lineTotal: deriveTotalString({ ...item, unitPrice }),
    totalManual: false,
  };
}

function buildTotalPatch(
  item: InvoiceLineItemFormValues,
  total: string,
): Partial<InvoiceLineItemFormValues> {
  const patch: Partial<InvoiceLineItemFormValues> = {
    lineTotal: total,
    totalManual: true,
  };

  const quantity = Number(item.quantity);
  const parsedTotal = Number(total);
  if (
    total.trim() !== "" &&
    Number.isFinite(quantity) &&
    quantity !== 0 &&
    Number.isFinite(parsedTotal)
  ) {
    patch.unitPrice = (parsedTotal / quantity).toFixed(2);
  }

  return patch;
}

function LineItemEntryFields({
  item,
  catalogItems,
  inputClass,
  labelClass,
  isPhoneWizard = false,
  descriptionPlaceholder,
  descriptionLabel,
  quantityLabel,
  quantityRequiredMessage,
  labelsLabel,
  unitPriceLabel,
  totalLabel,
  autoFocusDescription = false,
  onDescriptionFocused,
  onCommitFromTotal,
  onUpdate,
  onChangeDescription,
  onLoadCatalogItem,
  onChangeQuantity,
  onChangeUnitPrice,
  onChangeTotal,
}: LineItemEntryFieldsProps) {
  const labelsValue = item.labelsManual ? item.labelCount : item.quantity;
  const totalValue = item.totalManual ? item.lineTotal : deriveTotalString(item);
  const quantityError = quantityFieldError(item, quantityRequiredMessage);

  const advanceOnEnter =
    (nextFieldId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      focusFieldById(nextFieldId);
    };

  const advanceFromUnitPrice = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!item.unitPrice.trim()) {
      onChangeUnitPrice("0");
    }
    focusFieldById(`${item.id}-total`);
  };

  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${item.id}-description`} className={labelClass}>
          {descriptionLabel} <span className="text-destructive">*</span>
        </Label>
        <InvoiceLineItemDescriptionCombobox
          id={`${item.id}-description`}
          value={item.itemName}
          catalogItems={catalogItems}
          onValueChange={onChangeDescription}
          onCatalogItemSelect={onLoadCatalogItem}
          placeholder={descriptionPlaceholder}
          required
          autoFocus={autoFocusDescription}
          onAutoFocusComplete={onDescriptionFocused}
          onEnterCommit={() => focusFieldById(`${item.id}-quantity`)}
          {...inputClass(item.itemName)}
        />
      </div>

      <div className={cn("grid gap-4", isPhoneWizard ? "grid-cols-1" : "grid-cols-2 gap-3 md:grid-cols-4")}>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${item.id}-quantity`} className={labelClass}>
            {quantityLabel} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${item.id}-quantity`}
            type="number"
            min={1}
            step="1"
            value={item.quantity}
            onChange={(event) => onChangeQuantity(event.target.value)}
            onKeyDown={advanceOnEnter(`${item.id}-labels`)}
            aria-invalid={Boolean(quantityError)}
            {...inputClass(item.quantity)}
            required
          />
          {quantityError ? <p className="text-xs text-destructive">{quantityError}</p> : null}
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${item.id}-labels`} className={labelClass}>
            {labelsLabel}
          </Label>
          <Input
            id={`${item.id}-labels`}
            type="number"
            min={0}
            step="1"
            value={labelsValue}
            onChange={(event) =>
              onUpdate({ labelCount: event.target.value, labelsManual: true })
            }
            onKeyDown={advanceOnEnter(`${item.id}-unitPrice`)}
            {...inputClass(labelsValue)}
          />
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${item.id}-unitPrice`} className={labelClass}>
            {unitPriceLabel} <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${item.id}-unitPrice`}
            type="number"
            min={0}
            step="0.01"
            value={item.unitPrice}
            onChange={(event) => onChangeUnitPrice(event.target.value)}
            onKeyDown={advanceFromUnitPrice}
            {...inputClass(item.unitPrice)}
            required
          />
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${item.id}-total`} className={labelClass}>
            {totalLabel}
          </Label>
          <Input
            id={`${item.id}-total`}
            type="number"
            min={0}
            step="0.01"
            value={totalValue}
            onChange={(event) => onChangeTotal(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onCommitFromTotal();
            }}
            {...inputClass(totalValue)}
          />
        </div>
      </div>
    </div>
  );
}

function WizardLineItemsMobileCards({
  items,
  editingId,
  labelsColumn,
  emptyMessage,
  editLabel,
  deleteLabel,
  moveUpLabel,
  moveDownLabel,
  onEdit,
  onRemove,
  onMove,
}: WizardLineItemsMobileCardsProps) {
  const visibleItems = items.filter((item) => item.id !== editingId);

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-xl border bg-background px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-xs md:hidden">
      {visibleItems.map((item, index) => {
        const unitPrice = item.unitPrice.trim() ? Number(item.unitPrice) : 0;
        const quantity = Number(item.quantity) || 0;
        const labels = resolveLineLabelCount(item);

        return (
          <article key={item.id} className="border-b px-4 py-4 last:border-b-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="line-clamp-2 text-lg font-semibold leading-snug text-foreground">
                  {item.itemName.trim() || "—"}
                </p>
                <p className="mt-3 text-base tabular-nums text-muted-foreground">
                  {formatInvoiceMoney(unitPrice)} x {quantity || "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {labelsColumn}: {labels}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3">
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatInvoiceMoney(resolveLineTotal(item))}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-foreground hover:bg-muted"
                    aria-label={editLabel}
                    onClick={() => onEdit(item.id)}
                  >
                    <Pencil className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={deleteLabel}
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground"
                disabled={index === 0}
                aria-label={moveUpLabel}
                onClick={() => onMove(item.id, "up")}
              >
                <ArrowUp className="size-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-lg text-muted-foreground"
                disabled={index === visibleItems.length - 1}
                aria-label={moveDownLabel}
                onClick={() => onMove(item.id, "down")}
              >
                <ArrowDown className="size-5" />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function WizardLineItemsTable({
  items,
  editingId,
  descriptionColumn,
  quantityColumn,
  labelsColumn,
  unitPriceColumn,
  totalColumn,
  actionsColumn,
  emptyMessage,
  editLabel,
  deleteLabel,
  moveUpLabel,
  moveDownLabel,
  onEdit,
  onRemove,
  onMove,
}: WizardLineItemsTableProps) {
  const visibleItems = items.filter((item) => item.id !== editingId);

  return (
    <div className="hidden overflow-hidden rounded-xl border md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">{descriptionColumn}</th>
              <th className="w-20 px-3 py-2.5 font-medium">{quantityColumn}</th>
              <th className="w-20 px-3 py-2.5 font-medium">{labelsColumn}</th>
              <th className="w-28 px-3 py-2.5 font-medium">{unitPriceColumn}</th>
              <th className="w-28 px-3 py-2.5 font-medium">{totalColumn}</th>
              <th className="w-36 px-3 py-2.5 font-medium">{actionsColumn}</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleItems.map((item, index) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2.5 font-medium">{item.itemName.trim() || "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2.5 tabular-nums">{resolveLineLabelCount(item)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {item.unitPrice.trim() ? formatInvoiceMoney(Number(item.unitPrice)) : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatInvoiceMoney(resolveLineTotal(item))}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={editLabel}
                            onClick={() => onEdit(item.id)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{editLabel}</TooltipContent>
                      </Tooltip>
                      <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-sm text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:text-muted-foreground dark:text-emerald-400 dark:hover:text-emerald-300"
                              disabled={index === 0}
                              aria-label={moveUpLabel}
                              onClick={() => onMove(item.id, "up")}
                            >
                              <ArrowUp className="size-4" strokeWidth={2.25} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{moveUpLabel}</TooltipContent>
                        </Tooltip>
                        <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-sm text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 disabled:text-muted-foreground dark:text-blue-400 dark:hover:text-blue-300"
                              disabled={index === visibleItems.length - 1}
                              aria-label={moveDownLabel}
                              onClick={() => onMove(item.id, "down")}
                            >
                              <ArrowDown className="size-4" strokeWidth={2.25} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{moveDownLabel}</TooltipContent>
                        </Tooltip>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={deleteLabel}
                            onClick={() => onRemove(item.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{deleteLabel}</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableLineItemRow({
  item,
  index,
  lineItemCount,
  isWizard,
  inputClass,
  labelClass,
  catalogItems,
  descriptionPlaceholder,
  descriptionLabel,
  quantityLabel,
  quantityRequiredMessage,
  labelsLabel,
  unitPriceLabel,
  totalLabel,
  deleteLabel,
  moveUpLabel,
  moveDownLabel,
  dragToReorderLabel,
  onMove,
  onRemove,
  onUpdate,
  onChangeDescription,
  onLoadCatalogItem,
  onChangeQuantity,
  onChangeUnitPrice,
  onChangeTotal,
  deriveTotalString: getTotalString,
  autoFocusDescription = false,
  onDescriptionFocused,
  onCommitFromTotal,
}: SortableLineItemRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const labelsValue = item.labelsManual ? item.labelCount : item.quantity;
  const totalValue = item.totalManual ? item.lineTotal : getTotalString(item);
  const quantityError = quantityFieldError(item, quantityRequiredMessage);

  const advanceOnEnter =
    (nextFieldId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      focusFieldById(nextFieldId);
    };

  const advanceFromUnitPrice = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!item.unitPrice.trim()) {
      onChangeUnitPrice(index, "0");
    }
    focusFieldById(`${item.id}-total`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl p-4",
        isWizard ? "border-b border-border bg-transparent px-0 pb-6 pt-0" : "border bg-muted/10",
        isDragging && "relative z-10 opacity-80 shadow-md",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{t("invoices.form.lineItems.itemNumber", { number: index + 1 })}</p>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
            aria-label={dragToReorderLabel}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={setActivatorNodeRef}
                  type="button"
                  className="inline-flex size-8 cursor-grab items-center justify-center rounded-sm text-violet-600 transition-colors hover:bg-violet-500/10 hover:text-violet-700 active:cursor-grabbing dark:text-violet-400 dark:hover:text-violet-300"
                  aria-label={dragToReorderLabel}
                  {...attributes}
                  {...listeners}
                >
                  <ArrowUpDown className="size-4" strokeWidth={2.25} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{dragToReorderLabel}</TooltipContent>
            </Tooltip>
            <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-sm text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:text-muted-foreground dark:text-emerald-400 dark:hover:text-emerald-300"
                  disabled={index === 0}
                  aria-label={moveUpLabel}
                  onClick={() => onMove(index, "up")}
                >
                  <ArrowUp className="size-4" strokeWidth={2.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{moveUpLabel}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-sm text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 disabled:text-muted-foreground dark:text-blue-400 dark:hover:text-blue-300"
                  disabled={index === lineItemCount - 1}
                  aria-label={moveDownLabel}
                  onClick={() => onMove(index, "down")}
                >
                  <ArrowDown className="size-4" strokeWidth={2.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{moveDownLabel}</TooltipContent>
            </Tooltip>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={lineItemCount <= 1}
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-4" />
            {deleteLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${item.id}-description`} className={labelClass}>
            {descriptionLabel} <span className="text-destructive">*</span>
          </Label>
          <InvoiceLineItemDescriptionCombobox
            id={`${item.id}-description`}
            value={item.itemName}
            catalogItems={catalogItems}
            onValueChange={(next) => onChangeDescription(index, next)}
            onCatalogItemSelect={(catalogItem) => onLoadCatalogItem(index, catalogItem)}
            placeholder={descriptionPlaceholder}
            required
            autoFocus={autoFocusDescription}
            onAutoFocusComplete={onDescriptionFocused}
            onEnterCommit={() => focusFieldById(`${item.id}-quantity`)}
            {...(inputClass ? inputClass(item.itemName) : {})}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${item.id}-quantity`} className={labelClass}>
              {quantityLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${item.id}-quantity`}
              type="number"
              min={1}
              step="1"
              value={item.quantity}
              onChange={(event) => onChangeQuantity(index, event.target.value)}
              onKeyDown={advanceOnEnter(`${item.id}-labels`)}
              aria-invalid={Boolean(quantityError)}
              {...(inputClass ? inputClass(item.quantity) : {})}
              required
            />
            {quantityError ? <p className="text-xs text-destructive">{quantityError}</p> : null}
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${item.id}-labels`} className={labelClass}>
              {labelsLabel}
            </Label>
            <Input
              id={`${item.id}-labels`}
              type="number"
              min={0}
              step="1"
              value={labelsValue}
              onChange={(event) =>
                onUpdate(index, { labelCount: event.target.value, labelsManual: true })
              }
              onKeyDown={advanceOnEnter(`${item.id}-unitPrice`)}
              {...(inputClass ? inputClass(labelsValue) : {})}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${item.id}-unitPrice`} className={labelClass}>
              {unitPriceLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${item.id}-unitPrice`}
              type="number"
              min={0}
              step="0.01"
              value={item.unitPrice}
              onChange={(event) => onChangeUnitPrice(index, event.target.value)}
              onKeyDown={advanceFromUnitPrice}
              {...(inputClass ? inputClass(item.unitPrice) : {})}
              required
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor={`${item.id}-total`} className={labelClass}>
              {totalLabel}
            </Label>
            <Input
              id={`${item.id}-total`}
              type="number"
              min={0}
              step="0.01"
              value={totalValue}
              onChange={(event) => onChangeTotal(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onCommitFromTotal();
              }}
              {...(inputClass ? inputClass(totalValue) : {})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function useLineItemLabels() {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      addTitle: t("invoices.form.lineItems.addTitle"),
      editingTitle: t("invoices.form.lineItems.editingTitle"),
      cancelEdit: t("invoices.form.lineItems.cancelEdit"),
      addItem: t("invoices.form.lineItems.addItem"),
      saveChanges: t("common.actions.saveChanges"),
      itemsSubtotal: t("invoices.form.lineItems.itemsSubtotal"),
      emptyTable: t("invoices.form.lineItems.emptyTable"),
      duplicateHint: t("invoices.form.lineItems.duplicateHint"),
      descriptionPlaceholder: t("invoices.form.lineItems.descriptionPlaceholder"),
      descriptionLabel: t("invoices.form.lineItems.fields.description"),
      quantityLabel: t("invoices.form.lineItems.fields.quantity"),
      quantityRequiredMessage: t("invoices.form.lineItems.quantityRequired"),
      labelsLabel: t("invoices.form.lineItems.fields.labels"),
      unitPriceLabel: t("invoices.form.lineItems.fields.unitPrice"),
      totalLabel: t("invoices.form.lineItems.fields.total"),
      descriptionColumn: t("invoices.form.lineItems.columns.description"),
      quantityColumn: t("invoices.form.lineItems.columns.quantity"),
      labelsColumn: t("invoices.form.lineItems.columns.labels"),
      unitPriceColumn: t("invoices.form.lineItems.columns.unitPrice"),
      totalColumn: t("invoices.form.lineItems.columns.total"),
      actionsColumn: t("invoices.form.lineItems.columns.actions"),
      editLabel: t("common.actions.edit"),
      deleteLabel: t("common.actions.delete"),
      moveUpLabel: t("invoices.form.lineItems.moveUp"),
      moveDownLabel: t("invoices.form.lineItems.moveDown"),
      dragToReorderLabel: t("invoices.form.lineItems.dragToReorder"),
    }),
    [t],
  );
}

function InvoiceLineItemsWizardEditor({
  lineItems,
  catalogItems,
  isPhoneWizard = false,
  requestFocusKey = 0,
  onChange,
}: Omit<InvoiceLineItemsEditorProps, "appearance"> & { isPhoneWizard?: boolean }) {
  const { t } = useTranslation();
  const { notifySuccess } = useFeedback();
  const labels = useLineItemLabels();
  const wizardInputProps = (value: string) => wizardInputFieldProps(value);
  const labelClass = isPhoneWizard ? "text-xs font-medium text-muted-foreground" : undefined;

  const committedItems = useMemo(
    () => lineItems.filter(hasInvoiceLineItemContent),
    [lineItems],
  );

  const [draft, setDraft] = useState<InvoiceLineItemFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusDescription, setFocusDescription] = useState(true);
  const clearFocusDescription = useCallback(() => setFocusDescription(false), []);
  const activeDraft = draft ?? createEmptyInvoiceLineItem();
  const isDraftOpen = draft !== null || Boolean(editingId);

  useEffect(() => {
    if (!requestFocusKey) return;
    setDraft((current) => current ?? createEmptyInvoiceLineItem());
    setEditingId(null);
    setFocusDescription(true);
  }, [requestFocusKey]);
  const duplicateCommittedItem = findInvoiceLineItemWithDescription(
    committedItems,
    activeDraft.itemName,
    editingId ?? activeDraft.id,
  );

  function emitCommittedItems(items: InvoiceLineItemFormValues[]) {
    onChange(items.filter(hasInvoiceLineItemContent));
  }

  function openDraftForAdd() {
    setDraft(createEmptyInvoiceLineItem());
    setEditingId(null);
    setFocusDescription(true);
  }

  function updateDraft(patch: Partial<InvoiceLineItemFormValues>) {
    setDraft((current) => ({ ...(current ?? createEmptyInvoiceLineItem()), ...patch }));
  }

  function resetDraft() {
    setDraft(null);
    setEditingId(null);
    setFocusDescription(true);
  }

  function commitDraft() {
    if (!draft || !isDraftReadyToCommit(draft)) return;

    const finalized = finalizeLineItemDraft(draft);
    const { items, mergedIntoId } = commitInvoiceLineItemWithUniqueDescription(
      committedItems,
      finalized,
      editingId,
    );

    emitCommittedItems(items);
    if (mergedIntoId) {
      notifySuccess(t("invoices.form.lineItems.duplicateMerged"));
    }
    resetDraft();
  }

  function cancelEdit() {
    if (!editingId && draft === null) return;
    resetDraft();
  }

  function startEdit(id: string) {
    const item = committedItems.find((entry) => entry.id === id);
    if (!item) return;
    setDraft({ ...item });
    setEditingId(id);
    setFocusDescription(true);
  }

  function removeCommittedItem(id: string) {
    emitCommittedItems(committedItems.filter((item) => item.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  }

  function moveCommittedItem(id: string, direction: "up" | "down") {
    const index = committedItems.findIndex((item) => item.id === id);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= committedItems.length) return;
    emitCommittedItems(arrayMove(committedItems, index, targetIndex));
  }

  const draftHandlers: LineItemFieldHandlers = {
    onUpdate: updateDraft,
    onChangeDescription: (itemName) => updateDraft({ itemName, itemId: "" }),
    onLoadCatalogItem: (catalogItem) => {
      const unitPrice = catalogItem.price.toFixed(2);
      const patch: Partial<InvoiceLineItemFormValues> = {
        itemId: catalogItem.itemId,
        itemName: catalogItem.description,
        unitPrice,
      };
      if (!activeDraft.totalManual) {
        patch.lineTotal = deriveTotalString({ ...activeDraft, unitPrice });
      }
      updateDraft(patch);
    },
    onChangeQuantity: (quantity) => updateDraft(buildQuantityPatch(activeDraft, quantity)),
    onChangeUnitPrice: (unitPrice) => updateDraft(buildUnitPricePatch(activeDraft, unitPrice)),
    onChangeTotal: (total) => updateDraft(buildTotalPatch(activeDraft, total)),
  };

  return (
    <div className={cn("min-w-0 space-y-5", isPhoneWizard && "space-y-4")}>
      {isPhoneWizard ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("invoices.wizard.steps.lineItems")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {labels.addTitle}
          </h2>
        </div>
      ) : null}
      {isDraftOpen ? (
        <section
          className={cn(
            "space-y-4 rounded-xl border bg-muted/20 p-4",
            isPhoneWizard && "mx-1 border-border/80 bg-background p-3",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {editingId ? labels.editingTitle : labels.addTitle}
              </h3>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
              {editingId ? labels.cancelEdit : t("common.actions.cancel")}
            </Button>
          </div>

          <LineItemEntryFields
            item={activeDraft}
            catalogItems={catalogItems}
            inputClass={wizardInputProps}
            labelClass={labelClass}
            isPhoneWizard={isPhoneWizard}
            descriptionPlaceholder={labels.descriptionPlaceholder}
            descriptionLabel={labels.descriptionLabel}
            quantityLabel={labels.quantityLabel}
            quantityRequiredMessage={labels.quantityRequiredMessage}
            labelsLabel={labels.labelsLabel}
            unitPriceLabel={labels.unitPriceLabel}
            totalLabel={labels.totalLabel}
            autoFocusDescription={focusDescription}
            onDescriptionFocused={clearFocusDescription}
            onCommitFromTotal={commitDraft}
            {...draftHandlers}
          />
          {duplicateCommittedItem ? (
            <p className="text-sm text-muted-foreground">{labels.duplicateHint}</p>
          ) : null}
          {isPhoneWizard ? (
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base font-semibold"
              onClick={commitDraft}
              disabled={!isDraftReadyToCommit(activeDraft)}
            >
              <Plus className="size-5" />
              {editingId ? labels.saveChanges : labels.addItem}
            </Button>
          ) : (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={commitDraft}
                disabled={!isDraftReadyToCommit(activeDraft)}
              >
                <Plus className="size-4" />
                {editingId ? labels.saveChanges : labels.addItem}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <WizardLineItemsMobileCards
          items={committedItems}
          editingId={editingId}
          descriptionColumn={labels.descriptionColumn}
          quantityColumn={labels.quantityColumn}
          labelsColumn={labels.labelsColumn}
          unitPriceColumn={labels.unitPriceColumn}
          totalColumn={labels.totalColumn}
          actionsColumn={labels.actionsColumn}
          emptyMessage={labels.emptyTable}
          editLabel={labels.editLabel}
          deleteLabel={labels.deleteLabel}
          moveUpLabel={labels.moveUpLabel}
          moveDownLabel={labels.moveDownLabel}
          onEdit={startEdit}
          onRemove={removeCommittedItem}
          onMove={moveCommittedItem}
        />
        <WizardLineItemsTable
          items={committedItems}
          editingId={editingId}
          descriptionColumn={labels.descriptionColumn}
          quantityColumn={labels.quantityColumn}
          labelsColumn={labels.labelsColumn}
          unitPriceColumn={labels.unitPriceColumn}
          totalColumn={labels.totalColumn}
          actionsColumn={labels.actionsColumn}
          emptyMessage={labels.emptyTable}
          editLabel={labels.editLabel}
          deleteLabel={labels.deleteLabel}
          moveUpLabel={labels.moveUpLabel}
          moveDownLabel={labels.moveDownLabel}
          onEdit={startEdit}
          onRemove={removeCommittedItem}
          onMove={moveCommittedItem}
        />
        {!isDraftOpen ? (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary",
              isPhoneWizard ? "h-12 rounded-xl text-base font-semibold" : "h-10",
            )}
            onClick={openDraftForAdd}
          >
            <Plus className="size-4" />
            {labels.addItem}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

export function InvoiceLineItemsEditor({
  lineItems,
  catalogItems,
  appearance = "default",
  onChange,
  requestFocusKey = 0,
}: InvoiceLineItemsEditorProps) {
  const labels = useLineItemLabels();
  const isPhoneWizard = appearance === "phoneWizard";
  const isWizard = appearance === "wizard" || isPhoneWizard;
  const wizardInputProps = (value: string) =>
    isWizard ? wizardInputFieldProps(value) : { className: undefined };
  const labelClass = isWizard ? "text-xs font-normal text-muted-foreground" : undefined;
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const clearFocusItemId = useCallback(() => setFocusItemId(null), []);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (isWizard) {
    return (
      <InvoiceLineItemsWizardEditor
        lineItems={lineItems}
        catalogItems={catalogItems}
        isPhoneWizard={isPhoneWizard}
        requestFocusKey={requestFocusKey}
        onChange={onChange}
      />
    );
  }

  function updateLineItem(index: number, patch: Partial<InvoiceLineItemFormValues>) {
    onChange(lineItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    const newItem = createEmptyInvoiceLineItem();
    setFocusItemId(newItem.id);
    onChange([newItem, ...lineItems]);
  }

  function moveLineItem(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lineItems.length) return;

    onChange(arrayMove(lineItems, index, targetIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = lineItems.findIndex((item) => item.id === active.id);
    const newIndex = lineItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onChange(arrayMove(lineItems, oldIndex, newIndex));
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    onChange(lineItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function changeQuantity(index: number, quantity: string) {
    updateLineItem(index, buildQuantityPatch(lineItems[index], quantity));
  }

  function changeUnitPrice(index: number, unitPrice: string) {
    updateLineItem(index, buildUnitPricePatch(lineItems[index], unitPrice));
  }

  function changeTotal(index: number, total: string) {
    updateLineItem(index, buildTotalPatch(lineItems[index], total));
  }

  function loadCatalogItem(index: number, catalogItem: Item) {
    const item = lineItems[index];
    const unitPrice = catalogItem.price.toFixed(2);
    const patch: Partial<InvoiceLineItemFormValues> = {
      itemId: catalogItem.itemId,
      itemName: catalogItem.description,
      unitPrice,
    };
    if (!item.totalManual) {
      patch.lineTotal = deriveTotalString({ ...item, unitPrice });
    }
    updateLineItem(index, patch);
  }

  function changeDescription(index: number, itemName: string) {
    updateLineItem(index, { itemName, itemId: "" });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          <Plus className="size-4" />
          {labels.addItem}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lineItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <SortableLineItemRow
                key={item.id}
                item={item}
                index={index}
                lineItemCount={lineItems.length}
                isWizard={false}
                inputClass={wizardInputProps}
                labelClass={labelClass}
                catalogItems={catalogItems}
                descriptionPlaceholder={labels.descriptionPlaceholder}
                descriptionLabel={labels.descriptionLabel}
                quantityLabel={labels.quantityLabel}
                quantityRequiredMessage={labels.quantityRequiredMessage}
                labelsLabel={labels.labelsLabel}
                unitPriceLabel={labels.unitPriceLabel}
                totalLabel={labels.totalLabel}
                deleteLabel={labels.deleteLabel}
                moveUpLabel={labels.moveUpLabel}
                moveDownLabel={labels.moveDownLabel}
                dragToReorderLabel={labels.dragToReorderLabel}
                onMove={moveLineItem}
                onRemove={removeLineItem}
                onUpdate={updateLineItem}
                onChangeDescription={changeDescription}
                onLoadCatalogItem={loadCatalogItem}
                onChangeQuantity={changeQuantity}
                onChangeUnitPrice={changeUnitPrice}
                onChangeTotal={changeTotal}
                deriveTotalString={deriveTotalString}
                autoFocusDescription={focusItemId === item.id}
                onDescriptionFocused={clearFocusItemId}
                onCommitFromTotal={addLineItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-right">
        <p className="text-sm text-muted-foreground">{labels.itemsSubtotal}</p>
        <p className="text-lg font-semibold">{formatInvoiceMoney(subtotal)}</p>
      </div>
    </div>
  );
}
