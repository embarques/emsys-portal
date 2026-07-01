import { z } from "zod";

export const chartAccountSchema = z.object({
  displayName: z.string().trim().min(1, "Account name is required.").max(120),
  type: z.enum(["ASSET", "EXPENSE", "REVENUE", "BANK", "LOAN"]),
  description: z.string().trim().max(500),
  branchId: z.number().optional(),
  branchCode: z.string().optional(),
  parentAccountId: z.number().optional(),
  parentAccountName: z.string().optional(),
});
