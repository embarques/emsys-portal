export type CheckStatus = "outstanding" | "cleared";

export type Check = {
  id: string;
  status: CheckStatus;
  invoiceNumber: string;
  receiptNumber: string;
  createdAt: string;
  createdBy: string;
  depositedAt: string | null;
  depositedOn: string | null;
  depositedBy: string | null;
};

export type CheckFormValues = {
  invoiceNumber: string;
  receiptNumber: string;
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
    status: "outstanding",
    createdBy: "",
    depositedAt: "",
    depositedOn: "",
    depositedBy: "",
  };
}

function toDateInputValue(iso: string | null): string {
  if (!iso?.trim()) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function checkToFormValues(check: Check): CheckFormValues {
  return {
    invoiceNumber: check.invoiceNumber,
    receiptNumber: check.receiptNumber,
    status: check.status,
    createdBy: check.createdBy,
    depositedAt: toDateInputValue(check.depositedAt),
    depositedOn: check.depositedOn ?? "",
    depositedBy: check.depositedBy ?? "",
  };
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
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: values.createdBy.trim(),
    depositedAt,
    depositedOn: cleared && values.depositedOn.trim() ? values.depositedOn.trim() : null,
    depositedBy: cleared && values.depositedBy.trim() ? values.depositedBy.trim() : null,
  };
}
