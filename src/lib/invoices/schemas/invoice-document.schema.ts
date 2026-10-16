import { z } from "zod";

export function invoiceDocumentNameSchema(originalName: string) {
  const extension = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";
  return z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine(
        (name) =>
          !name.includes("/") &&
          !name.includes("\\") &&
          !Array.from(name).some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ) &&
          name.toLowerCase().endsWith(extension),
      ),
  });
}
