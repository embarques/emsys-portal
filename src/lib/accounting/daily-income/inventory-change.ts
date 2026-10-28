import {
  findCashPaymentMethod,
  type AccountingLookup,
  type ChartAccount,
  type DailyIncomeJournalValues,
  type InventoryHoldersRef,
} from "@/lib/accounting/daily-income/types";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

/** Selected holders, deduplicated; `null` vehicle when none is chosen. */
export function inventoryHoldersFromValues(values: DailyIncomeJournalValues): InventoryHoldersRef {
  const vehicleId = values.inventoryHolderVehicleId?.trim();
  const seen = new Set<number>();
  const employees = (values.inventoryHolderEmployees ?? []).filter((employee) => {
    if (!(employee.id > 0) || seen.has(employee.id)) return false;
    seen.add(employee.id);
    return true;
  });
  return {
    vehicle: vehicleId ? { id: vehicleId, name: values.inventoryHolderVehicleName?.trim() || vehicleId } : null,
    employees: employees.map((employee) => ({ id: employee.id, name: employee.name })),
  };
}

export function hasInventoryHolders(values: DailyIncomeJournalValues): boolean {
  const holders = inventoryHoldersFromValues(values);
  return holders.vehicle != null || holders.employees.length > 0;
}

/** Shortcut only: the user still decides who is responsible for the inventory. */
export function dailyRouteInventoryHolders(route: Pick<ActiveRoute, "vehicle" | "employees">): InventoryHoldersRef {
  const vehicleId = route.vehicle?.id?.trim();
  return {
    vehicle: vehicleId ? { id: vehicleId, name: route.vehicle.name?.trim() || vehicleId } : null,
    employees: route.employees.map((employee) => ({ id: employee.id, name: employee.name })),
  };
}

function isCashAccount(account: ChartAccount) {
  const searchable = [account.name, account.displayName].filter(Boolean).join(" ").toLowerCase();
  return /\bcash\b/.test(searchable) || /\befectivo\b/.test(searchable);
}

function isUserRevenueAccount(account: ChartAccount) {
  return account.type === "REVENUE" && !account.systemAccount;
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
