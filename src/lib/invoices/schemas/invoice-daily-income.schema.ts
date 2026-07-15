import { z } from "zod";

import {
  isCheckPaymentMethod,
  isZellePaymentMethod,
  requiresBankAccount,
} from "@/lib/accounting/daily-income/types";

const invoiceDailyIncomeRegistrationBaseSchema = z.object({
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
  checkNumber: z.string().optional(),
});

function refineInvoiceDailyIncomeRegistration(
  values: z.infer<typeof invoiceDailyIncomeRegistrationBaseSchema>,
  context: z.RefinementCtx,
  invoiceTotal?: number,
) {
  if (typeof invoiceTotal === "number" && values.amount > invoiceTotal) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "Payment amount cannot exceed the invoice total.",
    });
  }

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

  if (isCheckPaymentMethod(values.paymentMethodName) && !values.checkNumber?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["checkNumber"],
      message: "Check number is required.",
    });
  }
}

export function createInvoiceDailyIncomeRegistrationSchema(invoiceTotal: number) {
  return invoiceDailyIncomeRegistrationBaseSchema.superRefine((values, context) => {
    refineInvoiceDailyIncomeRegistration(values, context, invoiceTotal);
  });
}

export const invoiceDailyIncomeRegistrationSchema = invoiceDailyIncomeRegistrationBaseSchema.superRefine(
  (values, context) => {
    refineInvoiceDailyIncomeRegistration(values, context);
  },
);

export type InvoiceDailyIncomeRegistrationValues = z.infer<
  typeof invoiceDailyIncomeRegistrationSchema
>;
