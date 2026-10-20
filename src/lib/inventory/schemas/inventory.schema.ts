import { z } from "zod";

import { dateTimeLocalToIso } from "@/lib/inventory/utils/date-time";
import { parseUsdToMinor, parseWholeQuantity } from "@/lib/inventory/utils/money";
import type { InventoryFormValues } from "@/lib/inventory/types/catalog";
import { INVENTORY_STOCK_CONDITIONS } from "@/lib/inventory/types/common";
import type { DispatchFormValues, ReceiptFormValues } from "@/lib/inventory/types/documents";
import { INVENTORY_HOLDER_TYPES, type InventoryHolderFormValues } from "@/lib/inventory/types/holders";
import type { AdjustmentFormValues } from "@/lib/inventory/types/movements";
import {
  compactStringList,
  compactSupplierContacts,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";

/**
 * Issue messages are i18n keys under `inventory.form.validation.*` so the
 * component can translate the first failure.
 */
const V = "inventory.form.validation";

export type InventoryPayloadResult<T> = { ok: true; payload: T } | { ok: false, error: string };

function toResult<T>(parsed: z.ZodSafeParseResult<T>): InventoryPayloadResult<T> {
  if (parsed.success) return { ok: true, payload: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? `${V}.invalid` };
}

const requiredText = (message: string) => z.string().trim().min(1, message);
const optionalText = z.string().transform((value) => value.trim());

const instant = (message: string) =>
  z.string().transform((value, ctx) => {
    const iso = dateTimeLocalToIso(value);
    if (!iso) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return iso;
  });

const positiveQuantity = z.string().transform((value, ctx) => {
  const quantity = parseWholeQuantity(value);
  if (quantity === null) {
    ctx.addIssue({ code: "custom", message: `${V}.quantityRequired` });
    return z.NEVER;
  }
  return quantity;
});

const requiredUsdMinor = (message: string) =>
  z.string().transform((value, ctx) => {
    const minor = parseUsdToMinor(value);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return minor;
  });

function rejectDuplicateItems(lines: { itemId: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) {
      ctx.addIssue({ code: "custom", message: `${V}.duplicateItem` });
      return;
    }
    seen.add(line.itemId);
  }
}

const itemSchema = z.object({
  sku: optionalText,
  name: requiredText(`${V}.nameRequired`),
  unitOfMeasure: optionalText,
  category: optionalText,
  defaultSellingPrice: z.string().transform((value, ctx) => {
    if (!value.trim()) return undefined;
    const minor = parseUsdToMinor(value);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: `${V}.priceInvalid` });
      return z.NEVER;
    }
    return minor;
  }),
  reorderThreshold: z.string().transform((value, ctx) => {
    if (!value.trim()) return 0;
    const threshold = parseWholeQuantity(value, { allowZero: true });
    if (threshold === null) {
      ctx.addIssue({ code: "custom", message: `${V}.reorderInvalid` });
      return z.NEVER;
    }
    return threshold;
  }),
});

export type InventoryItemPayload = {
  sku: string;
  name: string;
  unitOfMeasure: string;
  category: string;
  currency: "USD";
  reorderThreshold: number;
  defaultSellingPriceMinor?: number;
};

/** `inventory.Item` write body. Stock quantities and cost are never sent. */
export function buildInventoryItemPayload(values: InventoryFormValues): InventoryPayloadResult<InventoryItemPayload> {
  const parsed = toResult(itemSchema.safeParse(values));
  if (!parsed.ok) return parsed;
  const { defaultSellingPrice, ...rest } = parsed.payload;
  return {
    ok: true,
    payload: {
      ...rest,
      currency: "USD",
      ...(defaultSellingPrice !== undefined ? { defaultSellingPriceMinor: defaultSellingPrice } : {}),
    },
  };
}

const supplierSchema = z
  .object({
    companyName: requiredText(`${V}.companyNameRequired`),
    contacts: z.array(z.object({ name: z.string(), phone: z.string(), email: z.string() })),
    addresses: z.array(z.string()),
  })
  .transform((values) => ({
    companyName: values.companyName,
    contacts: compactSupplierContacts(values.contacts),
    addresses: compactStringList(values.addresses),
  }))
  .superRefine((values, ctx) => {
    if (values.contacts.some((contact) => contact.email && !z.email().safeParse(contact.email).success)) {
      ctx.addIssue({ code: "custom", message: `${V}.emailInvalid` });
    }
  });

export type InventorySupplierPayload = z.output<typeof supplierSchema>;

/** `inventory.Supplier` write body (`contacts[]` of `{name, phone, email}`). */
export function buildInventorySupplierPayload(
  values: SupplierFormValues,
): InventoryPayloadResult<InventorySupplierPayload> {
  return toResult(supplierSchema.safeParse(values));
}

const receiptSchema = z
  .object({
    supplierId: requiredText(`${V}.supplierRequired`),
    toHolderId: requiredText(`${V}.warehouseRequired`),
    receivedAt: instant(`${V}.dateRequired`),
    notes: optionalText,
    lines: z
      .array(
        z.object({
          id: z.string().optional(),
          itemId: requiredText(`${V}.itemRequired`),
          quantity: positiveQuantity,
          unitCost: requiredUsdMinor(`${V}.unitCostRequired`),
        }),
      )
      .min(1, `${V}.linesRequired`)
      .superRefine(rejectDuplicateItems),
  })
  .transform(({ lines, notes, ...header }) => ({
    ...header,
    ...(notes ? { notes } : {}),
    lines: lines.map(({ id, itemId, quantity, unitCost }) => ({
      ...(id ? { id } : {}),
      itemId,
      quantity,
      unitCostMinor: unitCost,
    })),
  }));

export type InventoryReceiptPayload = z.output<typeof receiptSchema>;

/** `inventory.Receipt` draft body. Status, posting and audit fields are server-owned. */
export function buildInventoryReceiptPayload(
  values: ReceiptFormValues,
): InventoryPayloadResult<InventoryReceiptPayload> {
  return toResult(receiptSchema.safeParse(values));
}

const dispatchSchema = z
  .object({
    fromHolderId: requiredText(`${V}.sourceRequired`),
    toHolderId: requiredText(`${V}.destinationRequired`),
    assigneeEmployeeId: optionalText,
    dailyRouteId: optionalText,
    dispatchedAt: instant(`${V}.dateRequired`),
    notes: optionalText,
    lines: z
      .array(
        z.object({
          id: z.string().optional(),
          itemId: requiredText(`${V}.itemRequired`),
          quantity: positiveQuantity,
        }),
      )
      .min(1, `${V}.linesRequired`)
      .superRefine(rejectDuplicateItems),
  })
  .superRefine((values, ctx) => {
    if (values.fromHolderId === values.toHolderId) {
      ctx.addIssue({ code: "custom", message: `${V}.sameHolder` });
    }
  })
  .transform(({ assigneeEmployeeId, dailyRouteId, notes, lines, ...header }) => ({
    ...header,
    ...(assigneeEmployeeId ? { assigneeEmployeeId } : {}),
    ...(dailyRouteId ? { dailyRouteId } : {}),
    ...(notes ? { notes } : {}),
    lines: lines.map(({ id, itemId, quantity }) => ({ ...(id ? { id } : {}), itemId, quantity })),
  }));

export type InventoryDispatchPayload = z.output<typeof dispatchSchema>;

/** `inventory.Dispatch` draft body. Dispatch is a transfer and carries no revenue. */
export function buildInventoryDispatchPayload(
  values: DispatchFormValues,
): InventoryPayloadResult<InventoryDispatchPayload> {
  return toResult(dispatchSchema.safeParse(values));
}

const adjustmentSchema = z
  .object({
    holderId: requiredText(`${V}.holderRequired`),
    itemId: requiredText(`${V}.itemRequired`),
    condition: z.enum(INVENTORY_STOCK_CONDITIONS),
    adjustmentSign: z.enum(["increase", "decrease"]),
    quantity: positiveQuantity,
    reason: requiredText(`${V}.reasonRequired`),
    notes: optionalText,
    occurredAt: instant(`${V}.dateRequired`),
  })
  .transform(({ holderId, itemId, condition, adjustmentSign, quantity, reason, notes, occurredAt }) => ({
    holderId,
    reason,
    ...(notes ? { description: notes } : {}),
    occurredAt,
    lines: [{ itemId, condition, quantityDelta: adjustmentSign === "decrease" ? -quantity : quantity }],
  }));

export type InventoryAdjustmentPayload = z.output<typeof adjustmentSchema>;

/** `inventory.StockAdjustment` draft body with one signed line. */
export function buildInventoryAdjustmentPayload(
  values: AdjustmentFormValues,
): InventoryPayloadResult<InventoryAdjustmentPayload> {
  return toResult(adjustmentSchema.safeParse(values));
}

const holderSchema = z
  .object({
    type: z.enum(INVENTORY_HOLDER_TYPES),
    displayName: requiredText(`${V}.holderNameRequired`),
    entityId: optionalText,
  })
  .superRefine((values, ctx) => {
    if (values.type !== "WAREHOUSE" && !values.entityId) {
      ctx.addIssue({ code: "custom", message: `${V}.holderEntityRequired` });
    }
  })
  .transform(({ type, displayName, entityId }) => ({
    type,
    displayName,
    ...(type !== "WAREHOUSE" ? { entityId } : {}),
    isActive: true,
  }));

export type InventoryHolderPayload = z.output<typeof holderSchema>;

/** `inventory.InventoryHolder` create body. Warehouses carry no entity reference. */
export function buildInventoryHolderPayload(
  values: InventoryHolderFormValues,
): InventoryPayloadResult<InventoryHolderPayload> {
  return toResult(holderSchema.safeParse(values));
}
