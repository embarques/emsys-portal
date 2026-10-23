import { z } from "zod";
import { receiverSignatureSchema } from "@/lib/invoices/schemas/customer-signature.schema";

export const barcodeObjectId = z.string().regex(/^[a-f\d]{24}$/i);
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? "");
export const deliveryReviewSchema = z.object({
  pendingStatus: z.object({ id: z.literal(6), name: z.string() }),
  deliveredStatus: z.object({ id: z.literal(7), name: z.string() }),
  invoiceId: barcodeObjectId,
  invoiceNumber: z.string(),
  deliveryId: z.number().int().positive(),
  deliveryName: text,
  container: z.object({ id: z.number().int().positive(), name: text }),
  receiver: z
    .object({
      name: text,
      IDNumber: text,
      address: z
        .object({
          address1: text,
          apartment: text,
          city: text,
          state: text,
          zipcode: text,
        })
        .nullish(),
    })
    .transform(({ IDNumber, ...receiver }) => ({
      ...receiver,
      idNumber: IDNumber,
    }))
    .nullish(),
  barcodes: z
    .array(
      z.object({
        barcodeId: barcodeObjectId,
        number: z.string(),
        description: text,
      }),
    )
    .min(1)
    .max(200),
});
export type DeliveryReview = z.infer<typeof deliveryReviewSchema>;
export const deliveryWizardSchema = z.object({
  barcodeIds: z.array(barcodeObjectId).min(1).max(200),
  signerName: z.string().trim().min(1).max(200),
  idNumber: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => !/[\r\n\t]/.test(value)),
  agreed: z.boolean(),
  signatureDataUrl: z.string().startsWith("data:image/png;base64,").min(23),
});
export type DeliveryWizardValues = z.infer<typeof deliveryWizardSchema>;
export const completeDeliverySchema = z.object({
  requestId: z.string().uuid(),
  barcodeIds: z.array(barcodeObjectId).min(1).max(200),
  documentIds: z.array(barcodeObjectId).max(12),
  policyIds: z.array(z.number().int().positive()).max(100),
  agreed: z.boolean(),
  receiverSignature: receiverSignatureSchema,
});
export type CompleteDeliveryInput = z.infer<typeof completeDeliverySchema>;
export const completeDeliveryResultSchema = z.object({
  invoiceId: barcodeObjectId,
  deliveryId: z.number().int().positive(),
  signatureId: barcodeObjectId,
  deliveredCount: z.number().int().positive(),
});
