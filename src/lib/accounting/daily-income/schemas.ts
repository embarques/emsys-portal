import { z } from "zod";

import {
  isCheckPaymentMethod,
  isZellePaymentMethod,
  requiresBankAccount,
} from "@/lib/accounting/daily-income/types";

export type DailyIncomeStatementSchemaMessages = {
  dateRequired: string;
  branchRequired: string;
  currencyRequired: string;
  rateNonNegative: string;
};

export type DailyIncomeJournalSchemaMessages = {
  amountRequired: string;
  amountNonNegative: string;
  amountPositive: string;
  refNumberTooLong: string;
  descriptionTooLong: string;
  costPositive: string;
  discountNonNegative: string;
  zelleDateRequired: string;
  zelleNameRequired: string;
  checkNumberRequired: string;
  bankAccountRequired: string;
  employeeRequired: string;
  invoiceRequired: string;
  paymentMethodRequired: string;
  amountExceedsCost: string;
  senderRequired: string;
  receiverRequired: string;
  amountExceedsBalance: string;
  accountRequired: string;
  sourceAccountRequired: string;
  inventoryRequired: string;
  inventoryItemRequired: string;
  inventoryQuantityRequired: string;
  inventoryPriceRequired: string;
  supplierRequired: string;
};

export function createDailyIncomeStatementSchema(messages: DailyIncomeStatementSchemaMessages) {
  return z.object({
    date: z.string().min(1, messages.dateRequired),
    branchId: z.number().positive(messages.branchRequired),
    branchCode: z.string().min(1, messages.branchRequired),
    branchName: z.string().min(1, messages.branchRequired),
    currency: z.string().min(1, messages.currencyRequired),
    rate: z.number().min(0, messages.rateNonNegative),
  });
}

function hasJournalAssignee(values: { employeeId?: number; routeId?: string }) {
  return Boolean(values.employeeId) || Boolean(values.routeId?.trim());
}

function addAssigneeRequiredIssue(
  context: z.RefinementCtx,
  message: string,
  source?: "employee" | "route",
) {
  context.addIssue({
    code: "custom",
    path: source === "route" ? ["routeId"] : ["employeeId"],
    message,
  });
}

export function createDailyIncomeJournalSchema(messages: DailyIncomeJournalSchemaMessages) {
  return z
    .object({
      transactionType: z.enum([
        "INITIAL-PAYMENT",
        "PAYMENT",
        "DISCOUNT",
        "SURCHARGE",
        "EXPENSE",
        "SALES",
        "INVENTORY",
        "TRANSFER",
        "LOAN",
      ]),
      amount: z
        .number({ error: messages.amountRequired })
        .nonnegative(messages.amountNonNegative)
        .optional(),
      refNumber: z.string().trim().max(20, messages.refNumberTooLong),
      description: z.string().trim().max(500, messages.descriptionTooLong),
      employeeId: z.number().optional(),
      employeeName: z.string().optional(),
      employeeGroupId: z.string().optional(),
      employeeGroupName: z.string().optional(),
      assigneeSource: z.enum(["employee", "route"]).optional(),
      routeId: z.string().optional(),
      routeName: z.string().optional(),
      routeCrewId: z.string().optional(),
      routeCrewName: z.string().optional(),
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
      invoiceCost: z.number().positive(messages.costPositive).optional(),
      invoiceDiscount: z.number().nonnegative(messages.discountNonNegative).optional(),
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
      checkNumber: z.string().optional(),
      inventoryDirection: z.enum(["received", "dispatched"]).optional(),
      inventoryItemId: z.string().optional(),
      inventoryItemName: z.string().optional(),
      inventoryQuantity: z.number().optional(),
      inventoryUnitPrice: z.number().optional(),
      inventoryTotal: z.number().optional(),
      inventorySupplierId: z.string().optional(),
      inventorySupplierName: z.string().optional(),
    })
    .superRefine((values, context) => {
      if (values.transactionType === "INVENTORY") {
        if (!values.inventoryDirection) {
          context.addIssue({
            code: "custom",
            path: ["inventoryDirection"],
            message: messages.inventoryRequired,
          });
        }
        if (!values.inventoryItemId?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["inventoryItemId"],
            message: messages.inventoryItemRequired,
          });
        }
        if (!values.inventoryQuantity || values.inventoryQuantity <= 0) {
          context.addIssue({
            code: "custom",
            path: ["inventoryQuantity"],
            message: messages.inventoryQuantityRequired,
          });
        }
        if (values.inventoryTotal == null || values.inventoryTotal <= 0) {
          context.addIssue({
            code: "custom",
            path: ["inventoryTotal"],
            message: messages.inventoryPriceRequired,
          });
        }
        if (values.inventoryDirection === "received" && !values.inventorySupplierId?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["inventorySupplierId"],
            message: messages.supplierRequired,
          });
        }
        if (values.inventoryDirection === "dispatched" && !hasJournalAssignee(values)) {
          addAssigneeRequiredIssue(context, messages.employeeRequired, values.assigneeSource);
        }
        return;
      }

      if (values.amount == null) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: messages.amountRequired,
        });
      }
      if (values.transactionType !== "INITIAL-PAYMENT" && (values.amount ?? 0) <= 0) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: messages.amountPositive,
        });
      }

      const paymentDetailsRequired = (values.amount ?? 0) > 0;

      if (paymentDetailsRequired && isZellePaymentMethod(values.paymentMethodName)) {
        if (!values.zelleTransactionDate?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["zelleTransactionDate"],
            message: messages.zelleDateRequired,
          });
        }
        if (!values.zelleTransactionName?.trim()) {
          context.addIssue({
            code: "custom",
            path: ["zelleTransactionName"],
            message: messages.zelleNameRequired,
          });
        }
      }

      if (
        paymentDetailsRequired &&
        isCheckPaymentMethod(values.paymentMethodName) &&
        !values.checkNumber?.trim()
      ) {
        context.addIssue({
          code: "custom",
          path: ["checkNumber"],
          message: messages.checkNumberRequired,
        });
      }

      if (
        paymentDetailsRequired &&
        requiresBankAccount(values.paymentMethodName) &&
        (!values.paymentAccountId || values.paymentAccountType !== "BANK")
      ) {
        context.addIssue({
          code: "custom",
          path: ["paymentAccountId"],
          message: messages.bankAccountRequired,
        });
      }

      if (values.transactionType === "INITIAL-PAYMENT") {
        if (!hasJournalAssignee(values)) {
          addAssigneeRequiredIssue(context, messages.employeeRequired, values.assigneeSource);
        }
        if (!values.invoiceNumber?.trim()) {
          context.addIssue({ code: "custom", path: ["invoiceNumber"], message: messages.invoiceRequired });
        }
        if (!values.invoiceCost || values.invoiceCost <= 0) {
          context.addIssue({ code: "custom", path: ["invoiceCost"], message: messages.costPositive });
        }
        if (paymentDetailsRequired && !values.paymentMethodId) {
          context.addIssue({
            code: "custom",
            path: ["paymentMethodId"],
            message: messages.paymentMethodRequired,
          });
        }
        if (
          values.invoiceCost != null &&
          values.amount != null &&
          values.amount > Math.max(0, values.invoiceCost - (values.invoiceDiscount ?? 0))
        ) {
          context.addIssue({
            code: "custom",
            path: ["amount"],
            message: messages.amountExceedsCost,
          });
        }
        if (values.includeSender && !values.senderId?.trim()) {
          context.addIssue({ code: "custom", path: ["senderId"], message: messages.senderRequired });
        }
        if (values.includeReceiver && !values.receiverId?.trim()) {
          context.addIssue({ code: "custom", path: ["receiverId"], message: messages.receiverRequired });
        }
        return;
      }

      if (values.transactionType === "PAYMENT") {
        if (!hasJournalAssignee(values)) {
          addAssigneeRequiredIssue(context, messages.employeeRequired, values.assigneeSource);
        }
        if (!values.invoiceId) {
          context.addIssue({ code: "custom", path: ["invoiceId"], message: messages.invoiceRequired });
        }
        if (!values.paymentMethodId) {
          context.addIssue({
            code: "custom",
            path: ["paymentMethodId"],
            message: messages.paymentMethodRequired,
          });
        }
        if (values.invoiceBalance != null && values.amount != null && values.amount > values.invoiceBalance) {
          context.addIssue({
            code: "custom",
            path: ["amount"],
            message: messages.amountExceedsBalance,
          });
        }
        return;
      }

      if (!hasJournalAssignee(values)) {
        addAssigneeRequiredIssue(context, messages.employeeRequired, values.assigneeSource);
      }

      const invoiceRelated = ["DISCOUNT", "SURCHARGE"].includes(values.transactionType);
      if (invoiceRelated && !values.invoiceId) {
        context.addIssue({ code: "custom", path: ["invoiceId"], message: messages.invoiceRequired });
      }
      if ((invoiceRelated || values.transactionType === "SALES") && !values.paymentMethodId) {
        context.addIssue({
          code: "custom",
          path: ["paymentMethodId"],
          message: messages.paymentMethodRequired,
        });
      }

      const accountRelated = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(values.transactionType);
      if (accountRelated && !values.accountId) {
        context.addIssue({ code: "custom", path: ["accountId"], message: messages.accountRequired });
      }

      const sourceAccountRelated = ["EXPENSE", "TRANSFER", "LOAN"].includes(values.transactionType);
      if (sourceAccountRelated && !values.sourceAccountId) {
        context.addIssue({
          code: "custom",
          path: ["sourceAccountId"],
          message: messages.sourceAccountRequired,
        });
      }
    });
}

const defaultStatementMessages: DailyIncomeStatementSchemaMessages = {
  dateRequired: "Date is required.",
  branchRequired: "Branch is required.",
  currencyRequired: "Currency is required.",
  rateNonNegative: "Rate cannot be negative.",
};

const defaultJournalMessages: DailyIncomeJournalSchemaMessages = {
  amountRequired: "Amount is required.",
  amountNonNegative: "Amount cannot be negative.",
  amountPositive: "Amount must be greater than zero.",
  refNumberTooLong: "Reference number is too long.",
  descriptionTooLong: "Description is too long.",
  costPositive: "Cost must be greater than zero.",
  discountNonNegative: "Discount cannot be negative.",
  zelleDateRequired: "Zelle transaction date is required.",
  zelleNameRequired: "Zelle transaction name is required.",
  checkNumberRequired: "Check number is required.",
  bankAccountRequired: "Select a bank account for this payment method.",
  employeeRequired: "Select an employee or a daily route.",
  invoiceRequired: "Invoice is required.",
  paymentMethodRequired: "Payment method is required.",
  amountExceedsCost: "Amount cannot exceed cost.",
  senderRequired: "Sender client is required.",
  receiverRequired: "Receiver client is required.",
  amountExceedsBalance: "Amount cannot exceed the invoice balance.",
  accountRequired: "Account is required.",
  sourceAccountRequired: "Source account is required.",
  inventoryRequired: "Select received or dispatched.",
  inventoryItemRequired: "Item is required.",
  inventoryQuantityRequired: "Quantity must be greater than zero.",
  inventoryPriceRequired: "Enter a unit price or total.",
  supplierRequired: "Supplier is required.",
};

export const dailyIncomeStatementSchema = createDailyIncomeStatementSchema(defaultStatementMessages);
export const dailyIncomeJournalSchema = createDailyIncomeJournalSchema(defaultJournalMessages);

export { createChartAccountSchema } from "@/lib/accounting/chart-accounts/schemas/chart-account.schema";
