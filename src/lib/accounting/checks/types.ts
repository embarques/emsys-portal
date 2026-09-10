import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

export type CheckStatus = "outstanding" | "cleared";

export type Check = {
  id: string;
  status: CheckStatus;
  invoiceNumber: string;
  receiptNumber: string;
  referenceNumber: string;
  createdAt: string;
  createdBy: string;
  depositedAt: string | null;
  depositedOn: string | null;
  depositedBy: string | null;
};

export type CheckFormValues = {
  invoiceNumber: string;
  receiptNumber: string;
  referenceNumber: string;
  status: CheckStatus;
  createdBy: string;
  depositedAt: string;
  depositedOn: string;
  depositedBy: string;
};

export function createEmptyCheckForm(): CheckFormValues {
  return {
    invoiceNumber: "",
    receiptNumber: "",
    referenceNumber: "",
    status: "outstanding",
    createdBy: "",
    depositedAt: "",
    depositedOn: "",
    depositedBy: "",
  };
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function checkToFormValues(check: Check): CheckFormValues {
  return {
    invoiceNumber: check.invoiceNumber,
    receiptNumber: check.receiptNumber,
    referenceNumber: check.referenceNumber,
    status: check.status,
    createdBy: check.createdBy,
    depositedAt: toDateInputValue(check.depositedAt),
    depositedOn: check.depositedOn ?? "",
    depositedBy: check.depositedBy ?? "",
  };
}

export function areCheckFormValuesEquivalent(
  left: CheckFormValues,
  right: CheckFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}

export function formValuesToCheck(id: string, values: CheckFormValues, createdAt?: string): Check {
  const cleared = values.status === "cleared";
  const depositedAt =
    cleared && values.depositedAt.trim()
      ? new Date(`${values.depositedAt.trim()}T12:00:00`).toISOString()
      : null;

  return {
    id,
    status: values.status,
    invoiceNumber: values.invoiceNumber.trim(),
    receiptNumber: values.receiptNumber.trim(),
    referenceNumber: values.referenceNumber.trim(),
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: values.createdBy.trim(),
    depositedAt,
    depositedOn: cleared && values.depositedOn.trim() ? values.depositedOn.trim() : null,
    depositedBy: cleared && values.depositedBy.trim() ? values.depositedBy.trim() : null,
  };
}
