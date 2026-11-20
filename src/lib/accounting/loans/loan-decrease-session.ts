import { buildLoanDecreasePayload, decreaseLoan } from "./api";
import type { LoanDecreaseResult, LoanDecreaseValues } from "./types";
import { createRandomId } from "@/lib/utils/id";

/** One mounted entry session; uncertain commands retain their UUID and input snapshot. */
export function createLoanDecreaseSession(send = decreaseLoan, newRequestId = createRandomId) {
  const attempts = new Map<string, {
    requestId: string;
    values: LoanDecreaseValues;
    pending?: Promise<LoanDecreaseResult>;
  }>();

  return async (scope: string, values: LoanDecreaseValues): Promise<LoanDecreaseResult> => {
    const key = JSON.stringify([scope, values.loanId, buildLoanDecreasePayload(values)]);
    let attempt = attempts.get(key);
    if (attempt?.pending) return attempt.pending;
    if (!attempt) {
      attempt = { requestId: newRequestId(), values: Object.freeze({ ...values }) };
      attempts.set(key, attempt);
    }
    const current = attempt;
    current.pending = send(current.requestId, current.values).then(loan => {
      attempts.delete(key);
      return loan;
    }).finally(() => { current.pending = undefined; });
    return current.pending;
  };
}
