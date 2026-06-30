import { z } from "zod";

import { isZellePaymentMethod, requiresBankAccount } from "@/lib/accounting/daily-income/types";

export const dailyIncomeStatementSchema = z.object({
  date: z.string().min(1, "Date is required."),
  branchId: z.number().positive("Branch is required."),
  branchCode: z.string().min(1, "Branch is required."),
  branchName: z.string().min(1, "Branch is required."),
  currency: z.string().min(1, "Currency is required."),
  rate: z.number().min(0, "Rate cannot be negative."),
});

export const dailyIncomeJournalSchema = z.object({
  transactionType: z.enum([
    "INITIAL-PAYMENT",
    "PAYMENT",
    "DISCOUNT",
    "SURCHARGE",
    "EXPENSE",
    "SALES",
    "TRANSFER",
    "LOAN",
  ]),
  amount: z.number().positive("Amount must be greater than zero."),
  refNumber: z.string().trim().max(20, "Reference number is too long."),
  description: z.string().trim().max(500, "Description is too long."),
  employeeId: z.number().optional(),
  employeeName: z.string().optional(),
  accountId: z.number().optional(),
  accountName: z.string().optional(),
  accountType: z.string().optional(),
  paymentAccountId: z.number().optional(),
  paymentAccountName: z.string().optional(),
  paymentAccountType: z.string().optional(),
  sourceAccountId: z.number().optional(),
  sourceAccountName: z.string().optional(),
  sourceAccountType: z.string().optional(),
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceCost: z.number().optional(),
  invoiceBalance: z.number().optional(),
  includeSender: z.boolean().optional(),
  includeReceiver: z.boolean().optional(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  receiverId: z.string().optional(),
  receiverName: z.string().optional(),
  paymentMethodId: z.number().optional(),
  paymentMethodName: z.string().optional(),
  zelleTransactionDate: z.string().optional(),
  zelleTransactionName: z.string().optional(),
}).superRefine((values, context) => {
  if (!values.employeeId) {
    context.addIssue({ code: "custom", path: ["employeeId"], message: "Employee is required." });
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

  if (
    requiresBankAccount(values.paymentMethodName) &&
    (!values.paymentAccountId || values.paymentAccountType !== "BANK")
  ) {
    context.addIssue({
      code: "custom",
      path: ["paymentAccountId"],
      message: "Select a bank account for this payment method.",
    });
  }

  if (values.transactionType === "INITIAL-PAYMENT") {
    if (!values.invoiceNumber?.trim()) {
      context.addIssue({ code: "custom", path: ["invoiceNumber"], message: "Invoice is required." });
    }
    if (!values.invoiceCost || values.invoiceCost <= 0) {
      context.addIssue({ code: "custom", path: ["invoiceCost"], message: "Cost must be greater than zero." });
    }
    if (values.invoiceCost != null && values.amount > values.invoiceCost) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Amount cannot exceed cost.",
      });
    }
    if (!values.paymentMethodId) {
      context.addIssue({ code: "custom", path: ["paymentMethodId"], message: "Payment method is required." });
    }
    if (values.includeSender && !values.senderId?.trim()) {
      context.addIssue({ code: "custom", path: ["senderId"], message: "Sender client is required." });
    }
    if (values.includeReceiver && !values.receiverId?.trim()) {
      context.addIssue({ code: "custom", path: ["receiverId"], message: "Receiver client is required." });
    }
    return;
  }

  const invoiceRelated = ["PAYMENT", "DISCOUNT", "SURCHARGE"].includes(values.transactionType);
  if (invoiceRelated && !values.invoiceId) {
    context.addIssue({ code: "custom", path: ["invoiceId"], message: "Invoice is required." });
  }
  if (
    values.transactionType === "PAYMENT" &&
    values.invoiceBalance != null &&
    values.amount > values.invoiceBalance
  ) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "Amount cannot exceed the invoice balance.",
    });
  }
  if ((invoiceRelated || values.transactionType === "SALES") && !values.paymentMethodId) {
    context.addIssue({ code: "custom", path: ["paymentMethodId"], message: "Payment method is required." });
  }

  const accountRelated = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(values.transactionType);
  if (accountRelated && !values.accountId) {
    context.addIssue({ code: "custom", path: ["accountId"], message: "Account is required." });
  }

  const sourceAccountRelated = ["EXPENSE", "TRANSFER", "LOAN"].includes(values.transactionType);
  if (sourceAccountRelated && !values.sourceAccountId) {
    context.addIssue({ code: "custom", path: ["sourceAccountId"], message: "Source account is required." });
  }
});

export const chartAccountSchema = z.object({
  displayName: z.string().trim().min(1, "Account name is required.").max(120),
  type: z.enum(["ASSET", "EXPENSE", "REVENUE", "BANK", "LOAN"]),
  description: z.string().trim().max(500),
  branchId: z.number().optional(),
  branchCode: z.string().optional(),
  parentAccountId: z.number().optional(),
  parentAccountName: z.string().optional(),
});
