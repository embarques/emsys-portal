import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { createEmptyEmployeeForm, type Employee } from "@/lib/employees/types";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { FormKeyboardNavigation } from "@/components/forms/form-keyboard-navigation";
import type { Branch } from "@/lib/branches/types";
import type { ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";

const branches = [{ id: 1, code: "NY", name: "New York" }, { id: 2, code: "RD", name: "Dominican Republic" }] as Branch[];
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const accounts = [
  { id: 1, name: "Cash", displayName: "Cash", type: "ASSET" },
  { id: 2, name: "Expenses", displayName: "Expenses", type: "EXPENSE" },
  { id: 3, name: "Sales", displayName: "Sales", type: "REVENUE" },
  { id: 4, name: "Bank", displayName: "Bank", type: "BANK" },
] as ChartAccount[];
const paymentMethods = [{ id: 1, name: "CASH" }, { id: 2, name: "CHECK" }, { id: 3, name: "ZELLE" }];
const statementDefaults = { date: "2026-10-10", branchId: 1, branchCode: "NY", branchName: "New York", currency: "USD", rate: 1 };

export function DailyIncomeFixture({ transaction = false }: { transaction?: boolean }) {
  const [submitted, setSubmitted] = useState(0);
  const [step, setStep] = useState<TransactionFormStep | undefined>(
    document.documentElement.dataset.step as TransactionFormStep | undefined,
  );
  const [defaults] = useState<DailyIncomeJournalValues>(() => ({
    transactionType: (document.documentElement.dataset.transactionType ?? "EXPENSE") as JournalTransactionType,
    amount: document.documentElement.dataset.transactionType === "INITIAL-PAYMENT" ? 0 : 25, refNumber: "", description: "", employeeId: 1, employeeName: "Maria",
    ...(document.documentElement.dataset.ready === "true" ? { invoiceId: "test-invoice", invoiceNumber: "80430", invoiceCost: 100, invoiceBalance: 100, inventoryDirection: "dispatched" as const, inventoryItemId: "test-item", inventoryItemName: "Tape", inventoryQuantity: 1, inventoryUnitPrice: 25, inventoryTotal: 25 } : {}),
    accountId: 2, accountName: "Expenses", sourceAccountId: 1, sourceAccountName: "Cash",
    paymentMethodId: 1, paymentMethodName: "CASH",
  }));
  return (
    <QueryClientProvider client={client}>
      <FormKeyboardNavigation />
      {transaction ? <>
        <DailyIncomeTransactionForm
          quickEntry={document.documentElement.dataset.quickEntry === "true"}
          formId="transaction" transactionType={defaults.transactionType} initialValues={defaults}
          activeStep={step} onStepChange={setStep}
          onContinue={() => setStep(step === "assignment" ? "amounts" : step === "amounts" && defaults.transactionType !== "INVENTORY" ? "payment" : "review")}
          employees={[]} accounts={accounts} bankAccounts={[accounts[3]]} invoices={[]}
          paymentMethods={paymentMethods} statementBranchId={1} onSubmit={() => { setSubmitted((n) => n + 1); }}
        />
        <button id="save" form="transaction" type="submit">Save</button>
      </> : <DailyIncomeStatementForm branches={branches} initialValues={statementDefaults}
        isSubmitting={false} onCancel={() => {}} onSubmit={() => setSubmitted((n) => n + 1)} />}
      <output id="submitted">{submitted}</output>
      <output id="step">{step}</output>
    </QueryClientProvider>
  );
}

export function DailyIncomeWizardFixture() {
  const [submitted, setSubmitted] = useState(0);
  return <QueryClientProvider client={client}>
    <AddTransactionWizard open presentation="tab" mode="add" employees={[{ ...createEmptyEmployeeForm(), id: 1, name: "Maria", department: "Office", title: "Clerk", active: true, branch: branches[0] } as Employee]}
      statementBranchId={1} accounts={accounts} bankAccounts={[accounts[3]]} invoices={[]} paymentMethods={paymentMethods} isSubmitting={false}
      onSubmit={async () => { setSubmitted(n => n + 1); }} onCancel={() => {}} />
    <output id="submitted">{submitted}</output>
  </QueryClientProvider>;
}
