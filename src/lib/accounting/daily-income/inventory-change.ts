import { createDispatch, createReceipt } from "@/lib/inventory/mock-store";
import { findCashPaymentMethod, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

function isCashAccount(account: ChartAccount) {
  const searchable = [account.name, account.displayName].filter(Boolean).join(" ").toLowerCase();
  return /\bcash\b/.test(searchable) || /\befectivo\b/.test(searchable);
}

function isUserRevenueAccount(account: ChartAccount) {
  return account.type === "REVENUE" && !account.systemAccount;
}

function inventoryBusinessDate(statementDate?: string): string {
  if (statementDate?.trim()) {
    const day = statementDate.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function linkedInventoryTotal(quantity: number, unitPrice: number): number {
  if (!(quantity > 0) || !(unitPrice >= 0)) return 0;
  return roundMoney(quantity * unitPrice);
}

export function linkedInventoryUnitPrice(quantity: number, total: number): number {
  if (!(quantity > 0)) return 0;
  return roundMoney(total / quantity);
}

function inventoryDescription(values: DailyIncomeJournalValues): string {
  const item = values.inventoryItemName?.trim() || values.inventoryItemId || "";
  const quantity = values.inventoryQuantity ?? 0;
  if (values.inventoryDirection === "received") {
    const supplier = values.inventorySupplierName?.trim();
    return supplier ? `Received ${item} × ${quantity} from ${supplier}` : `Received ${item} × ${quantity}`;
  }
  return `Dispatched ${item} × ${quantity}`;
}

export function persistInventoryChange(values: DailyIncomeJournalValues, statementDate?: string): void {
  if (values.transactionType !== "INVENTORY") return;
  const itemId = values.inventoryItemId?.trim();
  const quantity = values.inventoryQuantity ?? 0;
  if (!itemId || quantity <= 0) return;
  const occurredAt = inventoryBusinessDate(statementDate);

  if (values.inventoryDirection === "received") {
    createReceipt({
      itemId,
      quantity: String(quantity),
      averageCost: String(values.inventoryUnitPrice ?? 0),
      supplierId: values.inventorySupplierId ?? "",
      receivedAt: occurredAt,
    });
    return;
  }

  createDispatch({
    itemId,
    quantity: String(quantity),
    incomeGained: String(values.inventoryTotal ?? 0),
    dispatchedAt: occurredAt,
    assigneeSource: values.assigneeSource === "route" ? "route" : "employee",
    employeeId: values.employeeId != null ? String(values.employeeId) : "",
    employeeName: values.employeeName ?? "",
    routeId: values.routeId ?? "",
    routeName: values.routeName ?? "",
    routeCrewId: values.routeCrewId ?? "",
    routeCrewName: values.routeCrewName ?? "",
  });
}

type FinalizeContext = {
  accounts: ChartAccount[];
  paymentMethods: AccountingLookup[];
};

export function finalizeInventoryChangeJournal(
  values: DailyIncomeJournalValues,
  context: FinalizeContext,
): DailyIncomeJournalValues {
  if (values.transactionType !== "INVENTORY") return values;

  const amount = values.inventoryTotal ?? values.amount ?? 0;
  const description = values.description.trim() || inventoryDescription(values);
  const cash = findCashPaymentMethod(context.paymentMethods);
  const cashAsset = context.accounts.find((account) => account.type === "ASSET" && isCashAccount(account));
  const assetFallback = context.accounts.find((account) => account.type === "ASSET");

  if (values.inventoryDirection === "received") {
    const expenseAccount = context.accounts.find((account) => account.type === "EXPENSE");
    const source = cashAsset ?? assetFallback;
    return {
      ...values,
      amount,
      description,
      accountId: values.accountId ?? expenseAccount?.id,
      accountName: values.accountName || expenseAccount?.displayName,
      accountType: values.accountType || expenseAccount?.type,
      sourceAccountId: values.sourceAccountId ?? source?.id,
      sourceAccountName: values.sourceAccountName || source?.displayName,
      sourceAccountType: values.sourceAccountType || source?.type,
      paymentMethodId: values.paymentMethodId ?? cash?.id,
      paymentMethodName: values.paymentMethodName || cash?.name,
    };
  }

  const revenueAccount = context.accounts.find(isUserRevenueAccount) ?? context.accounts.find((account) => account.type === "REVENUE");
  return {
    ...values,
    amount,
    description,
    accountId: values.accountId ?? revenueAccount?.id,
    accountName: values.accountName || revenueAccount?.displayName,
    accountType: values.accountType || revenueAccount?.type,
    paymentMethodId: values.paymentMethodId ?? cash?.id,
    paymentMethodName: values.paymentMethodName || cash?.name,
  };
}
