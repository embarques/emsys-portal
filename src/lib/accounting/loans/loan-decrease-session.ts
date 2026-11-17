import { buildLoanIncreasePayload, decreaseLoan } from "./api";
import type { Loan, LoanIncreaseValues } from "./types";
import { createRandomId } from "@/lib/utils/id";

/** One mounted entry session; uncertain commands retain their UUID and input snapshot. */
export function createLoanDecreaseSession(send = decreaseLoan, newRequestId = createRandomId) {
  const attempts = new Map<string, {
    requestId: string;
    values: LoanIncreaseValues;
    pending?: Promise<Loan>;
  }>();

  return async (scope: string, values: LoanIncreaseValues): Promise<Loan> => {
    const key = JSON.stringify([scope, values.loanId, buildLoanIncreasePayload(values)]);
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
