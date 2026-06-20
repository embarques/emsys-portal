import { z } from "zod";

export const dailyIncomeStatementSchema = z.object({
  date: z.string().min(1, "Date is required."),
  branchId: z.number().positive("Branch is required."),
  branchCode: z.string().min(1, "Branch is required."),
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
    "ACCOUNT-TRANSFER",
    "LOAN",
  ]),
  amount: z.number().positive("Amount must be greater than zero."),
  refNumber: z.string().trim().max(20, "Reference number is too long."),
  description: z.string().trim().max(500, "Description is too long."),
  employeeId: z.number().optional(),
  employeeName: z.string().optional(),
  accountId: z.number().optional(),
  accountName: z.string().optional(),
  sourceAccountId: z.number().optional(),
  sourceAccountName: z.string().optional(),
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  paymentMethodId: z.number().optional(),
  paymentMethodName: z.string().optional(),
}).superRefine((values, context) => {
  if (!values.employeeId) {
    context.addIssue({ code: "custom", path: ["employeeId"], message: "Employee is required." });
  }

  const invoiceRelated = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(values.transactionType);
  if (invoiceRelated && !values.invoiceId) {
    context.addIssue({ code: "custom", path: ["invoiceId"], message: "Invoice is required." });
  }
  if (invoiceRelated && !values.paymentMethodId) {
    context.addIssue({ code: "custom", path: ["paymentMethodId"], message: "Payment method is required." });
  }

  const accountRelated = ["EXPENSE", "SALES", "ACCOUNT-TRANSFER", "LOAN"].includes(values.transactionType);
  if (accountRelated && !values.accountId) {
    context.addIssue({ code: "custom", path: ["accountId"], message: "Account is required." });
  }

  const sourceAccountRelated = ["EXPENSE", "ACCOUNT-TRANSFER", "LOAN"].includes(values.transactionType);
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
