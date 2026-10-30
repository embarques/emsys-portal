import { z } from "zod";
import { isDeliveryBranchCode } from "@/lib/pickup-delivery-routes/types";

export const closeoutSetupSchema = z.object({
  currency: z.enum(["USD", "DOP"]),
  rate: z.number().finite().positive(),
});
export type CloseoutSetupValues = z.infer<typeof closeoutSetupSchema>;
export type TransactionBranch = { id: number; code: string; name: string };

export function buildTodayCloseoutPayload(branch: TransactionBranch, values: CloseoutSetupValues) {
  if (!Number.isInteger(branch.id) || branch.id <= 0) throw new Error("Select a branch.");
  const setup = closeoutSetupSchema.parse(isDeliveryBranchCode(branch.code) ? values : { currency: "USD", rate: 1 });
  return {
    branch: { id: branch.id, code: branch.code, name: branch.name },
    currency: setup.currency,
    rate: setup.currency === "USD" ? 1 : setup.rate,
  };
}
