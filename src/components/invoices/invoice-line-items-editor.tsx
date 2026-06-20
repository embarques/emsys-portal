"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  computeLineTotal,
  createEmptyInvoiceLineItem,
  resolveLineTotal,
  type InvoiceLineItemFormValues,
} from "@/lib/invoices/types";
import type { Item } from "@/lib/items/types";

type InvoiceLineItemsEditorProps = {
  lineItems: InvoiceLineItemFormValues[];
  catalogItems: Item[];
  onChange: (lineItems: InvoiceLineItemFormValues[]) => void;
};

/** Default total tracks unit price × quantity until the user overrides it. */
function deriveTotalString(item: InvoiceLineItemFormValues): string {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return "";
  return computeLineTotal(quantity, unitPrice).toFixed(2);
}

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

  function loadCatalogItem(index: number, itemId: string) {
    const catalogItem = catalogItems.find((entry) => entry.itemId === itemId);
    if (!catalogItem) {
      updateLineItem(index, { itemId: "" });
      return;
    }

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

  const subtotal = lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          <Plus className="size-4" />
          Add item
        </Button>
      </div>

      <div className="space-y-3">
        {lineItems.map((item, index) => {
          const labelsValue = item.labelsManual ? item.labelCount : item.quantity;
          const totalValue = item.totalManual ? item.lineTotal : deriveTotalString(item);

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
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${item.id}-catalog`}>Item from catalog</Label>
                  <SearchableSelect
                    id={`${item.id}-catalog`}
                    value={item.itemId}
                    onValueChange={(next) => loadCatalogItem(index, next)}
                    placeholder="Pick a catalog item (optional)"
                    searchPlaceholder="Search items…"
                    options={[
                      { value: "", label: "Custom item (type below)" },
                      ...catalogItems.map((catalogItem) => ({
                        value: catalogItem.itemId,
                        label: catalogItem.description,
                        descriptionLines: [formatInvoiceMoney(catalogItem.price)],
                      })),
                    ]}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${item.id}-description`}>
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${item.id}-description`}
                    value={item.itemName}
                    onChange={(event) =>
                      // Editing the text turns a catalog pick into a custom description.
                      updateLineItem(index, { itemName: event.target.value, itemId: "" })
                    }
                    placeholder="Custom description or pick from catalog"
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
                    onChange={(event) => changeQuantity(index, event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-labels`}>Labels</Label>
                  <Input
                    id={`${item.id}-labels`}
                    type="number"
                    min={0}
                    step="1"
                    value={labelsValue}
                    onChange={(event) =>
                      updateLineItem(index, { labelCount: event.target.value, labelsManual: true })
                    }
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
                    onChange={(event) => changeUnitPrice(index, event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${item.id}-total`}>Total</Label>
                  <Input
                    id={`${item.id}-total`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={totalValue}
                    onChange={(event) =>
                      updateLineItem(index, { lineTotal: event.target.value, totalManual: true })
                    }
                  />
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
    </div>
  );
}
