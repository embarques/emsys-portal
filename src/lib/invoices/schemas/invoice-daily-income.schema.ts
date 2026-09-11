import { z } from "zod";

import {
  isCheckPaymentMethod,
  isZellePaymentMethod,
  requiresBankAccount,
} from "@/lib/accounting/daily-income/types";
import {
  isInvoiceEmployeePickupSource,
  type InvoiceFormValues,
} from "@/lib/invoices/types";

const invoiceDailyIncomeRegistrationBaseSchema = z.object({
  amount: z.number().nonnegative("Payment amount cannot be negative."),
  assigneeSource: z.enum(["employee", "route"]).optional(),
  employeeId: z.number().optional(),
  employeeName: z.string().optional(),
  routeId: z.string().optional(),
  routeName: z.string().optional(),
  routeCrewId: z.string().optional(),
  routeCrewName: z.string().optional(),
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

export type InvoiceDailyIncomeRegistrationSchemaMessages = {
  assigneeRequired: string;
};

const DEFAULT_MESSAGES: InvoiceDailyIncomeRegistrationSchemaMessages = {
  assigneeRequired: "Select an employee or a daily route.",
};

function refineInvoiceDailyIncomeRegistration(
  values: z.infer<typeof invoiceDailyIncomeRegistrationBaseSchema>,
  context: z.RefinementCtx,
  invoiceTotal: number | undefined,
  messages: InvoiceDailyIncomeRegistrationSchemaMessages,
) {
  if (typeof invoiceTotal === "number" && values.amount > invoiceTotal) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "Payment amount cannot exceed the invoice total.",
    });
  }

  const hasAssignee = Boolean(values.employeeId) || Boolean(values.routeId?.trim());
  if (!hasAssignee) {
    context.addIssue({
      code: "custom",
      path: values.assigneeSource === "route" ? ["routeId"] : ["employeeId"],
      message: messages.assigneeRequired,
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

export function createInvoiceDailyIncomeRegistrationSchema(
  invoiceTotal: number,
  messages: InvoiceDailyIncomeRegistrationSchemaMessages = DEFAULT_MESSAGES,
) {
  return invoiceDailyIncomeRegistrationBaseSchema.superRefine((values, context) => {
    refineInvoiceDailyIncomeRegistration(values, context, invoiceTotal, messages);
  });
}

export const invoiceDailyIncomeRegistrationSchema = createInvoiceDailyIncomeRegistrationSchema(
  Number.POSITIVE_INFINITY,
);

export type InvoiceDailyIncomeRegistrationValues = z.infer<
  typeof invoiceDailyIncomeRegistrationBaseSchema
>;

/** Prefill payment assignee from invoice step-1 pickup route / employee. */
export function buildInvoiceDailyIncomeAssigneeDefaults(
  invoice: InvoiceFormValues,
  routeNameById?: Map<string, string>,
): Pick<
  InvoiceDailyIncomeRegistrationValues,
  | "assigneeSource"
  | "employeeId"
  | "employeeName"
  | "routeId"
  | "routeName"
  | "routeCrewId"
  | "routeCrewName"
> {
  if (invoice.pickupSource === "route" && invoice.routeId.trim()) {
    const routeId = invoice.routeId.trim();
    const crewName = invoice.routeCrewName.trim();
    return {
      assigneeSource: "route",
      routeId,
      routeName: routeNameById?.get(routeId)?.trim() || crewName || routeId,
      routeCrewId: invoice.routeCrewId.trim() || undefined,
      routeCrewName: crewName || undefined,
      employeeId: undefined,
      employeeName: "",
    };
  }

  if (isInvoiceEmployeePickupSource(invoice.pickupSource) && invoice.pickupEmployeeId.trim()) {
    const employeeId = Number(invoice.pickupEmployeeId);
    return {
      assigneeSource: "employee",
      employeeId: Number.isFinite(employeeId) && employeeId > 0 ? employeeId : undefined,
      employeeName: invoice.pickupEmployeeName.trim() || undefined,
      routeId: undefined,
      routeName: "",
      routeCrewId: undefined,
      routeCrewName: "",
    };
  }

  return {
    assigneeSource: "employee",
    employeeId: undefined,
    employeeName: "",
    routeId: undefined,
    routeName: "",
    routeCrewId: undefined,
    routeCrewName: "",
  };
}
