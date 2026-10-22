import { z } from "zod";

export const MAX_SIGNATURE_PRINT_INVOICES = 100;
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const signatureId = z.union([objectId, z.literal("legacy")]);
export const receiverSignatureOptionSchema = z.object({
  id: signatureId,
  deliveryId: z.union([z.number().int().nonnegative(), z.string()]).transform(String).optional(),
  deliveryName: z.string().optional(),
  signerName: z.string(),
  signedAt: z.string().datetime({ offset: true }).optional(),
});
export const invoiceSignatureOptionsSchema = z.object({
  invoiceId: objectId,
  invoiceNumber: z.string(),
  senderSignature: z.object({ signerName: z.string() }).nullable(),
  receiverSignatures: z.array(receiverSignatureOptionSchema).max(101),
});
export const invoiceSignatureSelectionSchema = z.object({
  invoiceId: objectId,
  includeSender: z.boolean(),
  receiverSignatureId: z.union([signatureId, z.literal("")]).optional(),
});
export const invoicePrintFormSchema = z.object({
  selections: z.array(invoiceSignatureSelectionSchema).min(1).max(MAX_SIGNATURE_PRINT_INVOICES),
});
export type ReceiverSignatureOption = z.infer<typeof receiverSignatureOptionSchema>;
export type InvoiceSignatureOptions = z.infer<typeof invoiceSignatureOptionsSchema>;
export type InvoiceSignatureSelection = z.infer<typeof invoiceSignatureSelectionSchema>;
export type InvoicePrintForm = z.infer<typeof invoicePrintFormSchema>;
export type InvoicePrintDelivery = { deliveryId: string };
