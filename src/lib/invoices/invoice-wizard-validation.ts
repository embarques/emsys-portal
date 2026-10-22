import { canContinueInvoiceDailyIncomeStep, type InvoiceDailyIncomeContext } from "@/lib/invoices/invoice-daily-income-context";
import {
  getInvoiceFormBalance,
  hasInvoiceLineItemContent,
  hasPositiveInvoiceLineItemQuantity,
  isInvoiceEmployeePickupSource,
  resolveLineTotal,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import type { InvoiceWizardStep } from "@/components/invoices/invoice-wizard-stepper";

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
  policiesAgree: "invoice-policies-agree",
  policiesSignature: "invoice-signature-pad",
} as const;

export type InvoiceWizardIssue = {
  step: InvoiceWizardStep;
  fieldId: string;
  message: string;
};

type Translate = (key: string) => string;

export type InvoicePoliciesAgreementInput = {
  skipSignature?: boolean;
  agreed: boolean;
  signatureDataUrl: string | null;
};

export function findInvoiceWizardStep1Issue(
  values: InvoiceFormValues,
  t: Translate,
  options?: { includePaymentLocation?: boolean },
): InvoiceWizardIssue | null {
  const includePaymentLocation = options?.includePaymentLocation ?? true;
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
  if (includePaymentLocation && !values.paymentLocation) {
    return {
      step: 1,
      fieldId: INVOICE_WIZARD_FIELDS.paymentLocation,
      message: t("invoices.wizard.validation.paymentLocationRequired"),
    };
  }
  if (!values.autoGenerateNumber && !values.invoiceNumber.trim()) {
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
  values?: Pick<InvoiceFormValues, "paymentLocation">,
  paymentStep: InvoiceWizardStep = 4,
): InvoiceWizardIssue | null {
  if (values && !values.paymentLocation) {
    return {
      step: paymentStep,
      fieldId: INVOICE_WIZARD_FIELDS.paymentLocation,
      message: t("invoices.wizard.validation.paymentLocationRequired"),
    };
  }
  if (canContinueInvoiceDailyIncomeStep(context)) return null;
  return {
    step: paymentStep,
    fieldId: INVOICE_WIZARD_FIELDS.dailyIncome,
    message:
      purpose === "save"
        ? t("invoices.wizard.validation.dailyIncomeSaveRequired")
        : t("invoices.wizard.validation.dailyIncomeContinueRequired"),
  };
}

export function findInvoiceWizardPoliciesIssue(
  agreement: InvoicePoliciesAgreementInput,
  t: Translate,
  reviewStep: InvoiceWizardStep,
): InvoiceWizardIssue | null {
  if (!agreement.agreed) {
    return {
      step: reviewStep,
      fieldId: INVOICE_WIZARD_FIELDS.policiesAgree,
      message: t("invoices.wizard.validation.policiesAgreeRequired"),
    };
  }
  if (!agreement.skipSignature && !agreement.signatureDataUrl) {
    return {
      step: reviewStep,
      fieldId: INVOICE_WIZARD_FIELDS.policiesSignature,
      message: t("invoices.wizard.validation.policiesSignatureRequired"),
    };
  }
  return null;
}

export function findInvoiceWizardSaveIssue(options: {
  values: InvoiceFormValues;
  dailyIncome: InvoiceDailyIncomeContext;
  requireDailyIncome: boolean;
  requirePolicySignature: boolean;
  policiesAgreement: InvoicePoliciesAgreementInput;
  paymentStep: InvoiceWizardStep | null;
  previewStep: InvoiceWizardStep;
  t: Translate;
}): InvoiceWizardIssue | null {
  const {
    values,
    dailyIncome,
    requireDailyIncome,
    requirePolicySignature,
    policiesAgreement,
    paymentStep,
    previewStep,
    t,
  } = options;
  const amountPaid = Number(dailyIncome.registration?.amount ?? values.amountPaid ?? 0) || 0;
  const registeredCost = dailyIncome.registration?.invoice?.cost;
  const hasRegisteredCost = registeredCost != null && Number.isFinite(registeredCost);
  const lineSubtotal = values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const registeredCostMismatch =
    hasRegisteredCost && Math.round(Math.abs(lineSubtotal - (registeredCost as number)) * 100) / 100 >= 0.01;

  return (
    findInvoiceWizardStep1Issue(values, t, { includePaymentLocation: !requireDailyIncome }) ??
    findInvoiceWizardStep2Issue(values, t) ??
    findInvoiceWizardStep3Issue(values, t) ??
    (requireDailyIncome && paymentStep != null
      ? findInvoiceWizardPaymentIssue(dailyIncome, t, "save", values, paymentStep)
      : null) ??
    (requirePolicySignature
      ? findInvoiceWizardPoliciesIssue(policiesAgreement, t, previewStep)
      : null) ??
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
