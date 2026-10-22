import { z } from "zod";

export const customerSignatureSchema = z.object({
  signerName: z.string().trim().min(1),
  data: z.string().min(1).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  contentType: z.literal("image/png"),
});

export type CustomerSignature = z.infer<typeof customerSignatureSchema>;

export function buildCustomerSignature(signerName: string, dataUrl: string): CustomerSignature {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("Invalid signature image.");
  return customerSignatureSchema.parse({ signerName, data: dataUrl.slice(prefix.length), contentType: "image/png" });
}

export const receiverSignatureSchema = customerSignatureSchema.extend({
  idNumber: z.string().trim().min(1),
});

export type ReceiverSignature = z.infer<typeof receiverSignatureSchema>;
