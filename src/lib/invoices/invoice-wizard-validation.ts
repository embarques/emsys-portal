import { customerHasUnverifiedPrimaryAddress } from "@/lib/customers/types";
import { canContinueInvoiceDailyIncomeStep, type InvoiceDailyIncomeContext } from "@/lib/invoices/invoice-daily-income-context";
import {
  getInvoiceFormBalance,
  hasInvoiceLineItemContent,
  hasPositiveInvoiceLineItemQuantity,
  isInvoiceEmployeePickupSource,
  resolveLineTotal,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";

export const INVOICE_WIZARD_FIELDS = {
  date: "date",
  containerId: "containerId",
  routeId: "routeId",
  pickupEmployeeId: "pickupEmployeeId",
  paymentLocation: "paymentLocation",
  invoiceNumber: "invoiceNumber",
  senderId: "senderId",
  lineItems: "lineItems",
  dailyIncome: "daily-income",
  discount: "invoice-wizard-discount",
} as const;

export type InvoiceWizardIssue = {
  step: 1 | 2 | 3 | 4 | 5;
  fieldId: string;
  message: string;
};

type Translate = (key: string) => string;

export function findInvoiceWizardStep1Issue(
  values: InvoiceFormValues,
  t: Translate,
): InvoiceWizardIssue | null {
  if (!values.date.trim()) {
    return { step: 1, fieldId: INVOICE_WIZARD_FIELDS.date, message: t("invoices.wizard.validation.dateRequired") };
  }
  if (!values.containerId) {
    return {
      step: 1,
      fieldId: INVOICE_WIZARD_FIELDS.containerId,
      message: t("invoices.wizard.validation.containerRequired"),
    };
  }
  if (values.pickupSource === "route") {
    if (!values.routeId) {
      return {
        step: 1,
        fieldId: INVOICE_WIZARD_FIELDS.routeId,
        message: t("invoices.wizard.validation.pickupRouteRequired"),
      };
    }
  } else if (isInvoiceEmployeePickupSource(values.pickupSource) && !values.pickupEmployeeId) {
    return {
      step: 1,
      fieldId: INVOICE_WIZARD_FIELDS.pickupEmployeeId,
      message:
        values.pickupSource === "warehouse"
          ? t("invoices.wizard.validation.warehouseEmployeeRequired")
          : t("invoices.wizard.validation.officeEmployeeRequired"),
    };
  }
  if (!values.paymentLocation) {
    return {
      step: 1,
      fieldId: INVOICE_WIZARD_FIELDS.paymentLocation,
      message: t("invoices.wizard.validation.paymentLocationRequired"),
    };
  }
  if (!values.invoiceNumber.trim()) {
    return {
      step: 1,
      fieldId: INVOICE_WIZARD_FIELDS.invoiceNumber,
      message: t("invoices.wizard.validation.invoiceNumberRequired"),
    };
  }
  return null;
}

export function findInvoiceWizardStep2Issue(
  values: InvoiceFormValues,
  t: Translate,
): InvoiceWizardIssue | null {
  if (!values.sender) {
    return {
      step: 2,
      fieldId: INVOICE_WIZARD_FIELDS.senderId,
      message: t("invoices.wizard.validation.senderRequired"),
    };
  }
  if (isGoogleMapsConfigured() && customerHasUnverifiedPrimaryAddress(values.sender)) {
    return {
      step: 2,
      fieldId: INVOICE_WIZARD_FIELDS.senderId,
      message: t("invoices.wizard.validation.unverifiedSenderAddress"),
    };
  }
  return null;
}

export function findInvoiceWizardStep3Issue(
  values: InvoiceFormValues,
  t: Translate,
): InvoiceWizardIssue | null {
  const contentItems = values.lineItems.filter(hasInvoiceLineItemContent);
  if (contentItems.length === 0) {
    return {
      step: 3,
      fieldId: INVOICE_WIZARD_FIELDS.lineItems,
      message: t("invoices.wizard.validation.lineItemRequired"),
    };
  }
  if (contentItems.some((item) => !hasPositiveInvoiceLineItemQuantity(item))) {
    return {
      step: 3,
      fieldId: INVOICE_WIZARD_FIELDS.lineItems,
      message: t("invoices.wizard.validation.lineItemQuantityRequired"),
    };
  }
  return null;
}

export function findInvoiceWizardPaymentIssue(
  context: InvoiceDailyIncomeContext,
  t: Translate,
  purpose: "continue" | "save",
): InvoiceWizardIssue | null {
  if (canContinueInvoiceDailyIncomeStep(context)) return null;
  return {
    step: 4,
    fieldId: INVOICE_WIZARD_FIELDS.dailyIncome,
    message:
      purpose === "save"
        ? t("invoices.wizard.validation.dailyIncomeSaveRequired")
        : t("invoices.wizard.validation.dailyIncomeContinueRequired"),
  };
}

export function findInvoiceWizardSaveIssue(options: {
  values: InvoiceFormValues;
  dailyIncome: InvoiceDailyIncomeContext;
  requireDailyIncome: boolean;
  previewStep: 4 | 5;
  t: Translate;
}): InvoiceWizardIssue | null {
  const { values, dailyIncome, requireDailyIncome, previewStep, t } = options;
  const amountPaid = Number(dailyIncome.registration?.amount ?? values.amountPaid ?? 0) || 0;
  const registeredCost = dailyIncome.registration?.invoice?.cost;
  const hasRegisteredCost = registeredCost != null && Number.isFinite(registeredCost);
  const lineSubtotal = values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const registeredCostMismatch =
    hasRegisteredCost && Math.round(Math.abs(lineSubtotal - (registeredCost as number)) * 100) / 100 >= 0.01;

  return (
    findInvoiceWizardStep1Issue(values, t) ??
    findInvoiceWizardStep2Issue(values, t) ??
    findInvoiceWizardStep3Issue(values, t) ??
    (requireDailyIncome ? findInvoiceWizardPaymentIssue(dailyIncome, t, "save") : null) ??
    (registeredCostMismatch
      ? {
          step: 3,
          fieldId: INVOICE_WIZARD_FIELDS.lineItems,
          message: t("invoices.wizard.validation.registeredCostMismatch"),
        }
      : null) ??
    (getInvoiceFormBalance(values, amountPaid) < 0
      ? {
          step: previewStep,
          fieldId: INVOICE_WIZARD_FIELDS.discount,
          message: t("invoices.wizard.validation.negativeBalance"),
        }
      : null)
  );
}
