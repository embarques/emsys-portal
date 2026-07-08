import { z } from "zod";

import { isZellePaymentMethod, requiresBankAccount } from "@/lib/accounting/daily-income/types";

export const invoiceDailyIncomeRegistrationSchema = z
  .object({
    amount: z.number().nonnegative("Payment amount cannot be negative."),
    employeeId: z.number().optional(),
    employeeName: z.string().optional(),
    paymentMethodId: z.number().optional(),
    paymentMethodName: z.string().optional(),
    paymentAccountId: z.number().optional(),
    paymentAccountName: z.string().optional(),
    paymentAccountType: z.string().optional(),
    refNumber: z.string().trim().max(20, "Reference number is too long."),
    description: z.string().trim().max(500, "Description is too long."),
    zelleTransactionDate: z.string().optional(),
    zelleTransactionName: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (!values.employeeId) {
      context.addIssue({
        code: "custom",
        path: ["employeeId"],
        message: "Employee is required.",
      });
    }

    if (values.amount <= 0) return;

    if (!values.paymentMethodId) {
      context.addIssue({
        code: "custom",
        path: ["paymentMethodId"],
        message: "Payment method is required when a payment is entered.",
      });
    }

    if (requiresBankAccount(values.paymentMethodName) && !values.paymentAccountId) {
      context.addIssue({
        code: "custom",
        path: ["paymentAccountId"],
        message: "Select a bank account for this payment method.",
      });
    }

    if (isZellePaymentMethod(values.paymentMethodName)) {
      if (!values.zelleTransactionDate?.trim()) {
        context.addIssue({
          code: "custom",
          path: ["zelleTransactionDate"],
          message: "Zelle transaction date is required.",
        });
      }
      if (!values.zelleTransactionName?.trim()) {
        context.addIssue({
          code: "custom",
          path: ["zelleTransactionName"],
          message: "Zelle transaction name is required.",
        });
      }
    }
  });

export type InvoiceDailyIncomeRegistrationValues = z.infer<
  typeof invoiceDailyIncomeRegistrationSchema
>;
