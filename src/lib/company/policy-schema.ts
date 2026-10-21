import { z } from "zod";

export function createCompanyPolicySchema(message: string) {
  return z.object({ policyUrl: z.string().trim().max(2048, message).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && !/[\s]/.test(value);
    } catch { return false; }
  }, message) });
}
