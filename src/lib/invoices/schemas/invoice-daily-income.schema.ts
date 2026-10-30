import { z } from "zod";

import {
  isCheckPaymentMethod,
  requiresBankAccount,
} from "@/lib/accounting/daily-income/types";
import type { TranslateFn } from "@/lib/feedback/messages";
import { translate } from "@/lib/i18n/catalog";
import {
  isInvoiceEmployeePickupSource,
  type InvoiceFormValues,
} from "@/lib/invoices/types";

const translateEnglish: TranslateFn = (key, params) => translate("en", key, params);

const createInvoiceDailyIncomeRegistrationBaseSchema = (t: TranslateFn) => z.object({
  amount: z.number().nonnegative(t("invoices.wizard.dailyIncome.validation.amountNegative")),
  assigneeSource: z.enum(["employee", "route"]).optional(),
  employeeId: z.number().optional(),
  employeeName: z.string().optional(),
  employeeGroupId: z.string().optional(),
  employeeGroupName: z.string().optional(),
  routeId: z.string().optional(),
  routeName: z.string().optional(),
  routeCrewId: z.string().optional(),
  routeCrewName: z.string().optional(),
  paymentMethodId: z.number().optional(),
  paymentMethodName: z.string().optional(),
  paymentAccountId: z.number().optional(),
  paymentAccountName: z.string().optional(),
  paymentAccountType: z.string().optional(),
  refNumber: z.string().trim().max(20, t("invoices.wizard.dailyIncome.validation.refNumberTooLong")),
  refNumberMode: z.enum(["system", "custom"]).optional(),
  description: z.string().trim().max(500, t("invoices.wizard.dailyIncome.validation.descriptionTooLong")),
  checkNumber: z.string().optional(),
});

function refineInvoiceDailyIncomeRegistration(
  values: z.infer<ReturnType<typeof createInvoiceDailyIncomeRegistrationBaseSchema>>,
  context: z.RefinementCtx,
  invoiceTotal: number | undefined,
  t: TranslateFn,
) {
  if (typeof invoiceTotal === "number" && values.amount > invoiceTotal) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: t("invoices.wizard.dailyIncome.validation.amountExceedsTotal"),
    });
  }

  if (values.amount <= 0) return;

  if (!values.paymentMethodId) {
    context.addIssue({
      code: "custom",
      path: ["paymentMethodId"],
      message: t("invoices.wizard.dailyIncome.validation.paymentMethodRequired"),
    });
  }

  if (requiresBankAccount(values.paymentMethodName) && !values.paymentAccountId) {
    context.addIssue({
      code: "custom",
      path: ["paymentAccountId"],
      message: t("invoices.wizard.dailyIncome.validation.bankAccountRequired"),
    });
  }

  if (isCheckPaymentMethod(values.paymentMethodName) && !values.checkNumber?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["checkNumber"],
      message: t("invoices.wizard.dailyIncome.validation.checkNumberRequired"),
    });
  }

  if (values.refNumberMode === "custom" && !values.refNumber.trim()) {
    context.addIssue({
      code: "custom",
      path: ["refNumber"],
      message: t("invoices.wizard.dailyIncome.validation.refNumberRequired"),
    });
  }
}

export function createInvoiceDailyIncomeRegistrationSchema(
  invoiceTotal: number,
  t: TranslateFn = translateEnglish,
) {
  return createInvoiceDailyIncomeRegistrationBaseSchema(t).superRefine((values, context) => {
    refineInvoiceDailyIncomeRegistration(values, context, invoiceTotal, t);
  });
}

export const invoiceDailyIncomeRegistrationSchema = createInvoiceDailyIncomeRegistrationSchema(
  Number.POSITIVE_INFINITY,
);

export type InvoiceDailyIncomeRegistrationValues = z.infer<
  ReturnType<typeof createInvoiceDailyIncomeRegistrationBaseSchema>
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
  | "employeeGroupId"
  | "employeeGroupName"
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
