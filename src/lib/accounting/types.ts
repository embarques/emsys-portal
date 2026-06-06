import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";
import {
  createInvoicePayment,
  computeInvoiceSubtotal,
  type Invoice,
  type InvoicePaymentMethod,
} from "@/lib/invoices/types";
import { todayDateInputValue } from "@/lib/orders/types";

export type AccountingBranch = "usa" | "dr";

export type AccountingEntryType =
  | "invoice_payment_new"
  | "invoice_payment_existing"
  | "invoice_discount"
  | "expense"
  | "income";

export type AccountingEntry = {
  entryId: string;
  type: AccountingEntryType;
  date: string;
  amount: number;
  description: string;
  branch: AccountingBranch;
  routeAssignmentId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceTotal?: number;
  amountPaid?: number;
  senderName?: string;
  receiverName?: string;
  paymentMethod?: InvoicePaymentMethod;
  receiptNumber?: string;
  referenceNumber?: string;
  category?: string;
  otherCategory?: string;
  linkedPaymentId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type AccountingFormValues = {
  entryId: string;
  type: AccountingEntryType;
  date: string;
  amount: string;
  description: string;
  branch: AccountingBranch;
  routeAssignmentId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: string;
  amountPaid: string;
  senderName: string;
  receiverName: string;
  paymentMethod: InvoicePaymentMethod;
  receiptNumber: string;
  referenceNumber: string;
  category: string;
  otherCategory: string;
  linkedPaymentId: string;
  createdBy: string;
};

export type AccountingFilterState = {
  query: string;
  type: AccountingEntryType | "all";
  branch: AccountingBranch | "all";
};

export const ACCOUNTING_BRANCHES: { value: AccountingBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const ACCOUNTING_ENTRY_TYPES: { value: AccountingEntryType; label: string; description: string }[] = [
  {
    value: "invoice_payment_new",
    label: "New invoice payment",
    description: "Register a payment with invoice number, total, amount paid, and payment type",
  },
  {
    value: "invoice_payment_existing",
    label: "Existing invoice payment",
    description: "Log a payment for an invoice with receipt number, amount paid, and payment method",
  },
  {
    value: "invoice_discount",
    label: "Invoice discount",
    description: "Apply a discount on an invoice with receipt number and payment method",
  },
  {
    value: "expense",
    label: "Expense",
    description: "Register an expense with category, payment method, amount paid, and description",
  },
  {
    value: "income",
    label: "Income",
    description: "Register income with category, payment method, amount paid, and description",
  },
];

export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Payroll",
  "Rent",
  "Utilities",
  "Office supplies",
  "Vehicle maintenance",
  "Insurance",
  "Taxes",
  "Shipping supplies",
  "Marketing",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Invoice collections",
  "Service fees",
  "Freight charges",
  "Storage fees",
  "Commissions",
  "Other",
] as const;

export function createAccountingEntryId(): string {
  return createRecordId();
}

export function createEmptyAccountingForm(createdBy = DEFAULT_CREATED_BY): AccountingFormValues {
  return {
    entryId: createAccountingEntryId(),
    type: "invoice_payment_new",
    date: todayDateInputValue(),
    amount: "",
    description: "",
    branch: "usa",
    routeAssignmentId: "",
    invoiceId: "",
    invoiceNumber: "",
    invoiceTotal: "",
    amountPaid: "",
    senderName: "",
    receiverName: "",
    paymentMethod: "cash",
    receiptNumber: "",
    referenceNumber: "",
    category: EXPENSE_CATEGORIES[0],
    otherCategory: "",
    linkedPaymentId: "",
    createdBy,
  };
}

export function resetAccountingFormForNextEntry(
  previous: AccountingFormValues,
  fixedType?: AccountingEntryType
): AccountingFormValues {
  const empty = createEmptyAccountingForm(previous.createdBy);
  const type = fixedType ?? previous.type;

  return {
    ...empty,
    type,
    date: previous.date,
    branch: previous.branch,
    routeAssignmentId: previous.routeAssignmentId,
    paymentMethod: previous.paymentMethod,
    category: isCategoryType(type) ? previous.category : getDefaultCategoryForType(type),
    otherCategory:
      isCategoryType(type) && previous.category === "Other" ? previous.otherCategory : "",
  };
}

export function accountingToFormValues(entry: AccountingEntry): AccountingFormValues {
  return {
    entryId: entry.entryId,
    type: entry.type,
    date: entry.date.slice(0, 10),
    amount: String(entry.amount),
    description: entry.description,
    branch: entry.branch,
    routeAssignmentId: entry.routeAssignmentId,
    invoiceId: entry.invoiceId ?? "",
    invoiceNumber: entry.invoiceNumber ?? "",
    invoiceTotal: entry.invoiceTotal !== undefined ? String(entry.invoiceTotal) : "",
    amountPaid:
      entry.amountPaid !== undefined
        ? String(entry.amountPaid)
        : entry.type === "invoice_payment_new" ||
            entry.type === "invoice_payment_existing" ||
            entry.type === "expense" ||
            entry.type === "income"
          ? String(entry.amount)
          : "",
    senderName: entry.senderName ?? "",
    receiverName: entry.receiverName ?? "",
    paymentMethod: entry.paymentMethod ?? "cash",
    receiptNumber: entry.receiptNumber ?? entry.referenceNumber ?? "",
    referenceNumber: entry.referenceNumber ?? "",
    category: entry.category ?? EXPENSE_CATEGORIES[0],
    otherCategory: entry.otherCategory ?? "",
    linkedPaymentId: entry.linkedPaymentId ?? "",
    createdBy: entry.createdBy,
  };
}

export function isInvoiceRelatedType(type: AccountingEntryType): boolean {
  return (
    type === "invoice_payment_new" ||
    type === "invoice_payment_existing" ||
    type === "invoice_discount"
  );
}

export function isExistingInvoicePaymentType(type: AccountingEntryType): boolean {
  return type === "invoice_payment_existing";
}

export function isInvoiceDiscountType(type: AccountingEntryType): boolean {
  return type === "invoice_discount";
}

export function isCategoryType(type: AccountingEntryType): boolean {
  return type === "expense" || type === "income";
}

export function isNewInvoicePaymentType(type: AccountingEntryType): boolean {
  return type === "invoice_payment_new";
}

export function findInvoiceByNumber(invoices: Invoice[], invoiceNumber: string): Invoice | undefined {
  const normalized = invoiceNumber.trim().toLowerCase();
  if (!normalized) return undefined;
  return invoices.find((invoice) => invoice.invoiceNumber.toLowerCase() === normalized);
}

export function getInvoiceTotalForAccounting(invoice: Invoice): number {
  return Math.round((computeInvoiceSubtotal(invoice.lineItems) - invoice.discount) * 100) / 100;
}

export function getNewInvoicePaymentBalance(entry: AccountingEntry): number {
  const total = entry.invoiceTotal ?? 0;
  const paid = entry.amountPaid ?? entry.amount;
  return Math.round((total - paid) * 100) / 100;
}

export function formValuesToAccountingEntry(
  values: AccountingFormValues,
  invoices: Invoice[],
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): AccountingEntry {
  if (!values.date) {
    throw new Error("Date is required.");
  }

  const routeAssignmentId = values.routeAssignmentId.trim();
  if (!routeAssignmentId) {
    throw new Error("Select a route assignment before registering entries.");
  }

  if (values.type === "invoice_payment_new") {
    if (!values.invoiceNumber.trim()) {
      throw new Error("Invoice number is required.");
    }

    const invoiceTotal = Number(values.invoiceTotal);
    const amountPaid = Number(values.amountPaid);

    if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) {
      throw new Error("Invoice total must be greater than 0.");
    }

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      throw new Error("Amount paid must be greater than 0.");
    }

    if (amountPaid > invoiceTotal) {
      throw new Error("Amount paid cannot exceed invoice total.");
    }

    const matchedInvoice = findInvoiceByNumber(invoices, values.invoiceNumber);

    return {
      entryId: values.entryId,
      type: values.type,
      date: values.date,
      amount: Math.round(amountPaid * 100) / 100,
      amountPaid: Math.round(amountPaid * 100) / 100,
      invoiceTotal: Math.round(invoiceTotal * 100) / 100,
      description: `Payment for ${values.invoiceNumber.trim()}`,
      branch: values.branch,
      routeAssignmentId,
      invoiceId: matchedInvoice?.invoiceId,
      invoiceNumber: values.invoiceNumber.trim(),
      senderName: values.senderName.trim() || matchedInvoice?.sender.name || "—",
      receiverName: values.receiverName.trim() || matchedInvoice?.receiver.name || "—",
      paymentMethod: values.paymentMethod,
      referenceNumber: values.referenceNumber.trim() || undefined,
      createdAt: createdAt ?? new Date().toISOString(),
      createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
  }

  if (values.type === "invoice_payment_existing") {
    if (!values.invoiceId) {
      throw new Error("Select an invoice.");
    }

    const invoice = invoices.find((entry) => entry.invoiceId === values.invoiceId);
    if (!invoice) {
      throw new Error("Selected invoice was not found.");
    }

    if (!values.receiptNumber.trim()) {
      throw new Error("Receipt number is required.");
    }

    const amountPaid = Number(values.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      throw new Error("Amount paid must be greater than 0.");
    }

    const receiptNumber = values.receiptNumber.trim();

    return {
      entryId: values.entryId,
      type: values.type,
      date: values.date,
      amount: Math.round(amountPaid * 100) / 100,
      amountPaid: Math.round(amountPaid * 100) / 100,
      description: `Payment for ${invoice.invoiceNumber} (Receipt ${receiptNumber})`,
      branch: values.branch,
      routeAssignmentId,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      senderName: invoice.sender.name,
      receiverName: invoice.receiver.name,
      paymentMethod: values.paymentMethod,
      receiptNumber,
      referenceNumber: receiptNumber,
      createdAt: createdAt ?? new Date().toISOString(),
      createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
  }

  if (values.type === "invoice_discount") {
    if (!values.invoiceId) {
      throw new Error("Select an invoice.");
    }

    const invoice = invoices.find((entry) => entry.invoiceId === values.invoiceId);
    if (!invoice) {
      throw new Error("Selected invoice was not found.");
    }

    if (!values.receiptNumber.trim()) {
      throw new Error("Receipt number is required.");
    }

    const discount = Number(values.amount);
    if (!Number.isFinite(discount) || discount <= 0) {
      throw new Error("Discount must be greater than 0.");
    }

    const receiptNumber = values.receiptNumber.trim();

    return {
      entryId: values.entryId,
      type: values.type,
      date: values.date,
      amount: Math.round(discount * 100) / 100,
      description: `Discount for ${invoice.invoiceNumber} (Receipt ${receiptNumber})`,
      branch: values.branch,
      routeAssignmentId,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      senderName: invoice.sender.name,
      receiverName: invoice.receiver.name,
      paymentMethod: values.paymentMethod,
      receiptNumber,
      referenceNumber: receiptNumber,
      createdAt: createdAt ?? new Date().toISOString(),
      createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
  }

  if (isCategoryType(values.type)) {
    if (!values.category) {
      throw new Error("Select a category.");
    }
    if (values.category === "Other" && !values.otherCategory.trim()) {
      throw new Error("Enter a description for the other category.");
    }

    const amountPaid = Number(values.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      throw new Error("Amount paid must be greater than 0.");
    }

    if (!values.description.trim()) {
      throw new Error("Description is required.");
    }

    return {
      entryId: values.entryId,
      type: values.type,
      date: values.date,
      amount: Math.round(amountPaid * 100) / 100,
      amountPaid: Math.round(amountPaid * 100) / 100,
      description: values.description.trim(),
      branch: values.branch,
      routeAssignmentId,
      paymentMethod: values.paymentMethod,
      referenceNumber: values.referenceNumber.trim() || undefined,
      category: values.category,
      otherCategory:
        values.category === "Other" ? values.otherCategory.trim() : undefined,
      createdAt: createdAt ?? new Date().toISOString(),
      createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
  }

  throw new Error("Unsupported entry type.");
}

export function applyAccountingEntryToInvoice(
  entry: AccountingEntry,
  invoice: Invoice
): Invoice {
  const timestamp = new Date().toISOString();

  if (entry.type === "invoice_payment_new" || entry.type === "invoice_payment_existing") {
    const payment = createInvoicePayment(
      invoice.invoiceId,
      {
        description: entry.description,
        amount: entry.amountPaid ?? entry.amount,
        paymentMethod: entry.paymentMethod ?? "cash",
        referenceNumber: entry.receiptNumber ?? entry.referenceNumber ?? "",
      },
      entry.createdBy
    );

    const payments = [...invoice.payments, payment];
    const amountPaid = payments.reduce((sum, item) => sum + item.amount, 0);

    return {
      ...invoice,
      payments,
      amountPaid: Math.round(amountPaid * 100) / 100,
      updatedAt: timestamp,
      activity: [
        ...invoice.activity,
        {
          id: createRecordId(),
          invoiceId: invoice.invoiceId,
          action: "payment",
          message: `Payment of $${entry.amount.toFixed(2)} recorded from Accounting.`,
          timestamp,
          performedBy: entry.createdBy,
          success: true,
        },
      ],
    };
  }

  if (entry.type === "invoice_discount") {
    return {
      ...invoice,
      discount: entry.amount,
      updatedAt: timestamp,
      activity: [
        ...invoice.activity,
        {
          id: createRecordId(),
          invoiceId: invoice.invoiceId,
          action: "discount_change",
          message: `Discount set to $${entry.amount.toFixed(2)} from Accounting.`,
          timestamp,
          performedBy: entry.createdBy,
          success: true,
        },
      ],
    };
  }

  return invoice;
}

export function getDefaultCategoryForType(type: AccountingEntryType): string {
  if (type === "income") return INCOME_CATEGORIES[0];
  if (type === "expense") return EXPENSE_CATEGORIES[0];
  return "";
}
