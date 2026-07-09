import { z } from "zod";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function createChartAccountSchema(t: TranslateFn) {
  return z.object({
    displayName: z
      .string()
      .trim()
      .min(1, t("accounting.chartOfAccounts.form.validation.displayNameRequired"))
      .max(120),
    type: z.enum(["ASSET", "EXPENSE", "REVENUE", "BANK", "LOAN"]),
    description: z.string().trim().max(500),
    branchId: z.number().optional(),
    branchCode: z.string().optional(),
    parentAccountId: z.number().optional(),
    parentAccountName: z.string().optional(),
  });
}

export type ChartAccountSchemaValues = z.infer<ReturnType<typeof createChartAccountSchema>>;
