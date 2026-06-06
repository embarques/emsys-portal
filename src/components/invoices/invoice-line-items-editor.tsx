"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  computeLineTotal,
  createEmptyInvoiceLineItem,
  type InvoiceLineItemFormValues,
} from "@/lib/invoices/types";
import type { Item } from "@/lib/items/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type InvoiceLineItemsEditorProps = {
  lineItems: InvoiceLineItemFormValues[];
  catalogItems: Item[];
  onChange: (lineItems: InvoiceLineItemFormValues[]) => void;
};

export function InvoiceLineItemsEditor({ lineItems, catalogItems, onChange }: InvoiceLineItemsEditorProps) {
  function updateLineItem(index: number, patch: Partial<InvoiceLineItemFormValues>) {
    onChange(lineItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    onChange([...lineItems, createEmptyInvoiceLineItem()]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    onChange(lineItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function loadCatalogItem(index: number, itemId: string) {
    const catalogItem = catalogItems.find((entry) => entry.itemId === itemId);
    if (!catalogItem) {
      updateLineItem(index, { itemId: "" });
      return;
    }

    updateLineItem(index, {
      itemId: catalogItem.itemId,
      itemName: catalogItem.description,
      unitPrice: catalogItem.price.toFixed(2),
    });
  }

  const subtotal = lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
    return sum + computeLineTotal(quantity, unitPrice);
  }, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Description (line items)</h3>
          <p className="text-sm text-muted-foreground">
            Add items with quantity, labels, unit price, and line total.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          <Plus className="h-4 w-4" />
          Add line item
        </Button>
      </div>

      <div className="space-y-3">
        {lineItems.map((item, index) => {
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          const lineTotal =
            Number.isFinite(quantity) && Number.isFinite(unitPrice)
              ? computeLineTotal(quantity, unitPrice)
              : 0;

          return (
            <div key={item.id} className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Item {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={lineItems.length <= 1}
                  onClick={() => removeLineItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${item.id}-catalog`}>Load from item catalog</Label>
                  <select
                    id={`${item.id}-catalog`}
                    className={selectClassName}
                    value={item.itemId}
                    onChange={(event) => loadCatalogItem(index, event.target.value)}
                  >
                    <option value="">Select catalog item or enter manually</option>
                    {catalogItems.map((catalogItem) => (
                      <option key={catalogItem.itemId} value={catalogItem.itemId}>
                        {catalogItem.description} · {formatInvoiceMoney(catalogItem.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${item.id}-name`}>
                    Item name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${item.id}-name`}
                    value={item.itemName}
                    onChange={(event) => updateLineItem(index, { itemName: event.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-quantity`}>
                    Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${item.id}-quantity`}
                    type="number"
                    min={1}
                    step="1"
                    value={item.quantity}
                    onChange={(event) => updateLineItem(index, { quantity: event.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-labels`}>Number of labels</Label>
                  <Input
                    id={`${item.id}-labels`}
                    type="number"
                    min={0}
                    step="1"
                    value={item.labelCount}
                    onChange={(event) => updateLineItem(index, { labelCount: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-unitPrice`}>
                    Unit price <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${item.id}-unitPrice`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => updateLineItem(index, { unitPrice: event.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Line total</Label>
                  <div className="flex h-9 items-center rounded-md border bg-muted/20 px-3 text-sm font-medium">
                    {formatInvoiceMoney(lineTotal)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-right">
        <p className="text-sm text-muted-foreground">Items subtotal</p>
        <p className="text-lg font-semibold">{formatInvoiceMoney(subtotal)}</p>
      </div>
    </section>
  );
}
