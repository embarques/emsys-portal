import { isCompleteFilterRow, type TableFilterFieldDefinition, type TableFilterRowState } from "@/lib/table/filter-builder";
import { parseTableFilterRange } from "@/lib/table/filter-range";
import { readApiUserUsername } from "@/lib/table/api-table-fields";
import { toApiPaymentMethodName, type DailyIncomeJournal } from "./types";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;
const SELECT_OPERATORS = ["eq", "neq"] as const;

export const DAILY_INCOME_TRANSACTION_TYPE_VALUES = [
  "INITIAL-PAYMENT", "PAYMENT", "EXPENSE", "SALES", "DISCOUNT", "SURCHARGE", "TRANSFER", "LOAN", "INVENTORY",
] as const;
export const DAILY_INCOME_PAYMENT_METHOD_VALUES = ["CASH", "CHECK", "ZELLE", "DEPOSIT", "CREDIT-CARD"] as const;

/**
 * Advanced filters shared by Daily Income and (once it moves onto journals) Pending Transactions.
 * Field keys are `POST /journals/search` paths; only `invoice.number`, `transactionType` and
 * `incomeStatement.id` are confirmed server-side, so Daily Income applies them to the loaded
 * closeout rows (see docs/pending-transactions-update.md).
 */
export const DAILY_INCOME_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "invoice.number", label: "Invoice #", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter invoice number…" },
  { field: "date", label: "Date", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "dateRange", label: "Date range", operators: ["eq"], valueType: "range", placeholder: "2026-01-01 to 2026-06-30" },
  { field: "createdBy.name", label: "User", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter user name…" },
  { field: "accounts.name", label: "Account", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter account name…" },
  { field: "invoice.cost", label: "Cost", operators: [...NUMERIC_OPERATORS], valueType: "text", placeholder: "0.00" },
  { field: "invoice.payment", label: "Payment", operators: [...NUMERIC_OPERATORS], valueType: "text", placeholder: "0.00" },
  { field: "invoice.balance", label: "Balance", operators: [...NUMERIC_OPERATORS], valueType: "text", placeholder: "0.00" },
  { field: "transactionAmount", label: "Amount", operators: [...NUMERIC_OPERATORS], valueType: "text", placeholder: "0.00" },
  { field: "employee.name", label: "Employee", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter employee name…" },
  {
    field: "transactionType",
    label: "Transaction",
    operators: [...SELECT_OPERATORS],
    valueType: "select",
    options: DAILY_INCOME_TRANSACTION_TYPE_VALUES.map((value) => ({ value, label: value })),
  },
  {
    field: "paymentMethod.name",
    label: "Payment method",
    operators: [...SELECT_OPERATORS],
    valueType: "select",
    options: DAILY_INCOME_PAYMENT_METHOD_VALUES.map((value) => ({ value, label: value })),
  },
  { field: "paymentReference", label: "Check number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter check number…" },
  { field: "external_reference_number", label: "External reference number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter external reference…" },
  { field: "incomeStatement.id", label: "Income statement", operators: [...NUMERIC_OPERATORS], valueType: "text", placeholder: "32685" },
  { field: "refNumber", label: "Internal reference number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter internal reference…" },
];

type FieldKind = "text" | "number" | "date";

const FIELD_READERS: Record<string, { kind: FieldKind; read: (journal: DailyIncomeJournal) => unknown }> = {
  "invoice.number": { kind: "text", read: (journal) => journal.invoice?.number },
  date: { kind: "date", read: (journal) => journal.date?.slice(0, 10) },
  dateRange: { kind: "date", read: (journal) => journal.date?.slice(0, 10) },
  "createdBy.name": {
    kind: "text",
    read: (journal) => {
      const user = journal.apiTableValues?.createdBy;
      const name = user && typeof user === "object" ? (user as Record<string, unknown>).name : undefined;
      return [readApiUserUsername(user), name];
    },
  },
  "accounts.name": {
    kind: "text",
    read: (journal) => [
      ...journal.accounts.map((account) => account.name),
      journal.account?.name,
      journal.paymentAccount?.name,
      journal.sourceAccount?.name,
    ],
  },
  "invoice.cost": { kind: "number", read: (journal) => journal.invoice?.cost },
  "invoice.payment": { kind: "number", read: (journal) => journal.invoice?.payment },
  "invoice.balance": { kind: "number", read: (journal) => journal.invoice?.balance },
  transactionAmount: { kind: "number", read: (journal) => journal.amount },
  "employee.name": { kind: "text", read: (journal) => journal.employee?.name },
  transactionType: { kind: "text", read: (journal) => journal.transactionType },
  "paymentMethod.name": {
    kind: "text",
    read: (journal) => (journal.paymentMethod?.name ? toApiPaymentMethodName(journal.paymentMethod.name) : undefined),
  },
  paymentReference: { kind: "text", read: (journal) => journal.checkNumber || journal.paymentReference },
  external_reference_number: { kind: "text", read: (journal) => journal.externalReferenceNumber },
  "incomeStatement.id": { kind: "number", read: (journal) => journal.incomeStatementId || undefined },
  refNumber: { kind: "text", read: (journal) => journal.refNumber },
};

function normalizeText(value: unknown) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function presentValues(value: unknown): unknown[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (entry) => entry !== undefined && entry !== null && String(entry).trim() !== "",
  );
}

function compare(actual: unknown, operator: string, expected: string, kind: FieldKind): boolean {
  if (kind === "number") {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left)) return false;
    if (operator === "gte") return left >= right;
    if (operator === "lte") return left <= right;
    return left === right;
  }
  if (kind === "date") {
    const left = String(actual).slice(0, 10);
    if (operator === "gte") return left >= expected;
    if (operator === "lte") return left <= expected;
    return left === expected;
  }
  const left = normalizeText(actual);
  const right = normalizeText(expected);
  if (operator === "contains") return left.includes(right);
  if (operator === "startsWith") return left.startsWith(right);
  return left === right;
}

function rowMatches(journal: DailyIncomeJournal, row: TableFilterRowState, definition: TableFilterFieldDefinition): boolean {
  const reader = FIELD_READERS[row.field];
  if (!reader) return true;
  const values = presentValues(reader.read(journal));
  const expected = row.value.trim();
  if (definition.valueType === "range") {
    const range = parseTableFilterRange(expected);
    if (!range) return true;
    return values.some((value) => compare(value, "gte", range.start, reader.kind) && compare(value, "lte", range.end, reader.kind));
  }
  if (reader.kind === "number" && !Number.isFinite(Number(expected))) return true;
  const operator = row.operator || definition.operators[0] || "eq";
  if (operator === "neq") return !values.some((value) => compare(value, "eq", expected, reader.kind));
  return values.some((value) => compare(value, operator, expected, reader.kind));
}

/** Applies advanced filter rows left to right (`(A and B) or C`), like the API filter builder. */
export function journalMatchesFilterRows(
  journal: DailyIncomeJournal,
  rows: readonly TableFilterRowState[],
  fields: readonly TableFilterFieldDefinition[] = DAILY_INCOME_TABLE_FILTER_FIELDS,
): boolean {
  let result: boolean | null = null;
  for (const row of rows) {
    const definition = fields.find((entry) => entry.field === row.field);
    if (!definition || !isCompleteFilterRow(row, [...fields])) continue;
    const matches = rowMatches(journal, row, definition);
    result = result === null ? matches : row.join === "or" ? result || matches : result && matches;
  }
  return result ?? true;
}
