import { z } from "zod";
import type { TranslateFn } from "@/lib/feedback/messages";

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

export function createLoanPaymentSchema(t: TranslateFn) {
  return z
    .object({
      employeeId: z.number().positive(t("accounting.loans.validation.employeeRequired")),
      employeeName: z.string().optional(),
      allocationMode: z.enum(["oldest-first", "specific-loan"]),
      loanId: z.string().optional(),
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
      if (values.allocationMode === "specific-loan" && !values.loanId) {
        context.addIssue({
          code: "custom",
          path: ["loanId"],
          message: t("accounting.loans.validation.loanRequired"),
        });
      }
    });
}
