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
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvoiceLineItemDescriptionCombobox } from "@/components/invoices/invoice-line-item-description-combobox";
import {
  wizardInputFieldProps,
} from "@/components/invoices/invoice-wizard-styles";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  computeLineTotal,
  createEmptyInvoiceLineItem,
  resolveLineTotal,
  type InvoiceLineItemFormValues,
} from "@/lib/invoices/types";
import type { Item } from "@/lib/items/types";
import { cn } from "@/lib/utils";

type InvoiceLineItemsEditorProps = {
  lineItems: InvoiceLineItemFormValues[];
  catalogItems: Item[];
  appearance?: "default" | "wizard";
  onChange: (lineItems: InvoiceLineItemFormValues[]) => void;
};

type SortableLineItemRowProps = {
  item: InvoiceLineItemFormValues;
  index: number;
  lineItemCount: number;
  isWizard: boolean;
  inputClass?: (value: string) => ReturnType<typeof wizardInputFieldProps> | { className?: undefined };
  labelClass?: string;
  catalogItems: Item[];
  onMove: (index: number, direction: "up" | "down") => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<InvoiceLineItemFormValues>) => void;
  onChangeDescription: (index: number, itemName: string) => void;
  onLoadCatalogItem: (index: number, catalogItem: Item) => void;
  onChangeQuantity: (index: number, quantity: string) => void;
  onChangeUnitPrice: (index: number, unitPrice: string) => void;
  deriveTotalString: (item: InvoiceLineItemFormValues) => string;
  autoFocusDescription?: boolean;
  onDescriptionFocused?: () => void;
  onCommitFromTotal: () => void;
};

/** Move keyboard focus to a sibling field within the same line item row. */
function focusFieldById(fieldId: string) {
  const element = document.getElementById(fieldId) as HTMLInputElement | null;
  if (!element) return;
  element.focus();
  element.select?.();
}

/** Default total tracks unit price × quantity until the user overrides it. */
function deriveTotalString(item: InvoiceLineItemFormValues): string {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return "";
  return computeLineTotal(quantity, unitPrice).toFixed(2);
}

function SortableLineItemRow({
  item,
  index,
  lineItemCount,
  isWizard,
  inputClass,
  labelClass,
  catalogItems,
  onMove,
  onRemove,
  onUpdate,
  onChangeDescription,
  onLoadCatalogItem,
  onChangeQuantity,
  onChangeUnitPrice,
  deriveTotalString: getTotalString,
  autoFocusDescription = false,
  onDescriptionFocused,
  onCommitFromTotal,
}: SortableLineItemRowProps) {
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

  /** Advance to the next field on Enter instead of submitting the wizard form. */
  const advanceOnEnter =
    (nextFieldId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      focusFieldById(nextFieldId);
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
        <p className="truncate text-sm font-medium">Item {index + 1}</p>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
            aria-label={`Reorder item ${index + 1}`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={setActivatorNodeRef}
                  type="button"
                  className="inline-flex size-8 cursor-grab items-center justify-center rounded-sm text-violet-600 transition-colors hover:bg-violet-500/10 hover:text-violet-700 active:cursor-grabbing dark:text-violet-400 dark:hover:text-violet-300"
                  aria-label={`Drag to reorder item ${index + 1}`}
                  {...attributes}
                  {...listeners}
                >
                  <ArrowUpDown className="size-4" strokeWidth={2.25} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Drag to reorder</TooltipContent>
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
                  aria-label={`Move item ${index + 1} up`}
                  onClick={() => onMove(index, "up")}
                >
                  <ArrowUp className="size-4" strokeWidth={2.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-sm text-blue-600 hover:bg-blue-500/10 hover:text-blue-700 disabled:text-muted-foreground dark:text-blue-400 dark:hover:text-blue-300"
                  disabled={index === lineItemCount - 1}
                  aria-label={`Move item ${index + 1} down`}
                  onClick={() => onMove(index, "down")}
                >
                  <ArrowDown className="size-4" strokeWidth={2.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move down</TooltipContent>
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
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${item.id}-description`} className={labelClass}>
            Description <span className="text-destructive">*</span>
          </Label>
          <InvoiceLineItemDescriptionCombobox
            id={`${item.id}-description`}
            value={item.itemName}
            catalogItems={catalogItems}
            onValueChange={(next) => onChangeDescription(index, next)}
            onCatalogItemSelect={(catalogItem) => onLoadCatalogItem(index, catalogItem)}
            placeholder="Type or search catalog items…"
            required
            autoFocus={autoFocusDescription}
            onAutoFocusComplete={onDescriptionFocused}
            onEnterCommit={() => focusFieldById(`${item.id}-quantity`)}
            {...(inputClass ? inputClass(item.itemName) : {})}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${item.id}-quantity`} className={labelClass}>
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${item.id}-quantity`}
            type="number"
            min={1}
            step="1"
            value={item.quantity}
            onChange={(event) => onChangeQuantity(index, event.target.value)}
            onKeyDown={advanceOnEnter(`${item.id}-labels`)}
            {...(inputClass ? inputClass(item.quantity) : {})}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${item.id}-labels`} className={labelClass}>
            Labels
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

        <div className="space-y-2">
          <Label htmlFor={`${item.id}-unitPrice`} className={labelClass}>
            Unit price <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${item.id}-unitPrice`}
            type="number"
            min={0}
            step="0.01"
            value={item.unitPrice}
            onChange={(event) => onChangeUnitPrice(index, event.target.value)}
            onKeyDown={advanceOnEnter(`${item.id}-total`)}
            {...(inputClass ? inputClass(item.unitPrice) : {})}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${item.id}-total`} className={labelClass}>
            Total
          </Label>
          <Input
            id={`${item.id}-total`}
            type="number"
            min={0}
            step="0.01"
            value={totalValue}
            onChange={(event) =>
              onUpdate(index, { lineTotal: event.target.value, totalManual: true })
            }
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
  );
}

export function InvoiceLineItemsEditor({
  lineItems,
  catalogItems,
  appearance = "default",
  onChange,
}: InvoiceLineItemsEditorProps) {
  const isWizard = appearance === "wizard";
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
    const item = lineItems[index];
    const patch: Partial<InvoiceLineItemFormValues> = { quantity };

    // Labels and total follow the quantity unless the user has overridden them.
    if (!item.labelsManual) patch.labelCount = quantity;
    if (!item.totalManual) {
      patch.lineTotal = deriveTotalString({ ...item, quantity });
    }

    updateLineItem(index, patch);
  }

  function changeUnitPrice(index: number, unitPrice: string) {
    const item = lineItems[index];
    const patch: Partial<InvoiceLineItemFormValues> = { unitPrice };
    if (!item.totalManual) {
      patch.lineTotal = deriveTotalString({ ...item, unitPrice });
    }
    updateLineItem(index, patch);
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
        <Button type="button" variant={isWizard ? "default" : "outline"} size="sm" onClick={addLineItem}>
          <Plus className="size-4" />
          Add item
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
                isWizard={isWizard}
                inputClass={wizardInputProps}
                labelClass={labelClass}
                catalogItems={catalogItems}
                onMove={moveLineItem}
                onRemove={removeLineItem}
                onUpdate={updateLineItem}
                onChangeDescription={changeDescription}
                onLoadCatalogItem={loadCatalogItem}
                onChangeQuantity={changeQuantity}
                onChangeUnitPrice={changeUnitPrice}
                deriveTotalString={deriveTotalString}
                autoFocusDescription={focusItemId === item.id}
                onDescriptionFocused={clearFocusItemId}
                onCommitFromTotal={addLineItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!isWizard ? (
        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-right">
          <p className="text-sm text-muted-foreground">Items subtotal</p>
          <p className="text-lg font-semibold">{formatInvoiceMoney(subtotal)}</p>
        </div>
      ) : null}
    </div>
  );
}
