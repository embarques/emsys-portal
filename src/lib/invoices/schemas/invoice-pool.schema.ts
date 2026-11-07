import { z } from "zod";

export const invoicePoolFormSchema = z.object({
  count: z.number().int().min(1).max(100),
  userId: z.number().int().min(0).max(65535),
});
export type InvoicePoolForm = z.infer<typeof invoicePoolFormSchema>;

export const reservedInvoiceSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  number: z.string().min(1),
  receivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  claimed: z.boolean().default(false),
  allocation: z.object({ userId: z.number().int().nonnegative(), token: z.string().min(1) }),
});
export type ReservedInvoice = z.infer<typeof reservedInvoiceSchema>;
export const invoicePoolPageSchema = z.object({
  items: z.array(reservedInvoiceSchema), remaining: z.number().int().nonnegative(),
  lowThreshold: z.number().int().nonnegative(), nextCursor: z.string().optional(),
});
export type InvoicePoolAction = {
  requestId: string; action: "generate" | "assign" | "return";
  count?: number; userId?: number; items?: { id: string; token: string }[];
};
