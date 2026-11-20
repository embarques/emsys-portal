import { z } from "zod";
import type { TranslateFn } from "@/lib/feedback/messages";

const toCents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);

export function createLoanFormSchema(t: TranslateFn) {
  return z.object({
    employeeId: z.number().positive(t("accounting.loans.validation.employeeRequired")),
    employeeName: z.string().optional(),
    loanAccountId: z.number().positive(t("accounting.loans.validation.loanAccountRequired")),
    loanAccountName: z.string().optional(),
    loanAccountType: z.string().optional(),
    sourceAccountId: z.number().positive(t("accounting.loans.validation.sourceAccountRequired")),
    sourceAccountName: z.string().optional(),
    sourceAccountType: z.string().optional(),
    principalAmount: z
      .number({ error: t("accounting.loans.validation.principalRequired") })
      .positive(t("accounting.loans.validation.principalPositive")),
    transactionDate: z.string().min(1, t("accounting.loans.validation.dateRequired")),
    referenceNumber: z.string().trim().max(40, t("accounting.loans.validation.referenceTooLong")),
    description: z.string().trim().max(500, t("accounting.loans.validation.descriptionTooLong")),
  });
}

/** Increase raises principal and amount owed. */
export function createLoanIncreaseSchema(t: TranslateFn) {
  return z.object({
    employeeId: z.number().positive(t("accounting.loans.validation.employeeRequired")),
    employeeName: z.string().optional(),
    loanId: z.string().min(1, t("accounting.loans.validation.loanRequired")),
    sourceAccountId: z.number().positive(t("accounting.loans.validation.sourceAccountRequired")),
    sourceAccountName: z.string().optional(),
    sourceAccountType: z.string().optional(),
    amount: z
      .number({ error: t("accounting.loans.validation.increaseAmountRequired") })
      .positive(t("accounting.loans.validation.increaseAmountPositive")),
    transactionDate: z.string().min(1, t("accounting.loans.validation.dateRequired")),
    referenceNumber: z.string().trim().max(40, t("accounting.loans.validation.referenceTooLong")),
    description: z.string().trim().max(500, t("accounting.loans.validation.descriptionTooLong")),
  });
}

/**
 * Decrease lowers principal and amount owed. When `maxBalance` is known, the
 * reduction cannot exceed the open balance (principal − paid).
 */
export function createLoanDecreaseSchema(t: TranslateFn, maxBalance?: number) {
  return z
    .object({
      employeeId: z.number().positive(t("accounting.loans.validation.employeeRequired")),
      employeeName: z.string().optional(),
      loanId: z.string().min(1, t("accounting.loans.validation.loanRequired")),
      // Shared form-shell defaults; forgiveness sends no funding fields.
      sourceAccountId: z.number(),
      sourceAccountName: z.string().optional(),
      sourceAccountType: z.string().optional(),
      amount: z
        .number({ error: t("accounting.loans.validation.decreaseAmountRequired") })
        .positive(t("accounting.loans.validation.decreaseAmountPositive"))
        .max(1e12, t("accounting.loans.validation.decreaseAmountInvalid"))
        .refine(value => Math.round(value * 100) > 0 && Math.abs(value * 100 - Math.round(value * 100)) <= 0.000001, t("accounting.loans.validation.decreaseAmountInvalid")),
      transactionDate: z.string().min(1, t("accounting.loans.validation.dateRequired")),
      referenceNumber: z.string().trim().max(40, t("accounting.loans.validation.referenceTooLong")),
      description: z.string().trim().max(500, t("accounting.loans.validation.descriptionTooLong")),
    })
    .superRefine((values, context) => {
      if (maxBalance == null || !Number.isFinite(maxBalance)) return;
      if (toCents(values.amount) > toCents(Math.max(0, maxBalance))) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: t("accounting.loans.validation.decreaseExceedsBalance"),
        });
      }
    });
}

/** Payment raises paid amount and lowers amount owed; cannot exceed open balance. */
export function createLoanPaymentSchema(t: TranslateFn, maxOutstanding?: number) {
  return z
    .object({
      employeeId: z.number().positive(t("accounting.loans.validation.employeeRequired")),
      employeeName: z.string().optional(),
      loanId: z.string().min(1, t("accounting.loans.validation.loanRequired")),
      receivedAccountId: z.number().positive(t("accounting.loans.validation.receivedAccountRequired")),
      receivedAccountName: z.string().optional(),
      receivedAccountType: z.string().optional(),
      amount: z
        .number({ error: t("accounting.loans.validation.paymentAmountRequired") })
        .positive(t("accounting.loans.validation.paymentAmountPositive")),
      transactionDate: z.string().min(1, t("accounting.loans.validation.dateRequired")),
      referenceNumber: z.string().trim().max(40, t("accounting.loans.validation.referenceTooLong")),
      description: z.string().trim().max(500, t("accounting.loans.validation.descriptionTooLong")),
    })
    .superRefine((values, context) => {
      if (maxOutstanding == null || !Number.isFinite(maxOutstanding)) return;
      if (toCents(values.amount) > toCents(Math.max(0, maxOutstanding))) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: t("accounting.loans.validation.paymentExceedsBalance"),
        });
      }
    });
}
