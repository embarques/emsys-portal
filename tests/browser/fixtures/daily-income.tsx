import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyIncomeStatementForm } from "@/components/accounting/daily-income-statement-form";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { FormKeyboardNavigation } from "@/components/forms/form-keyboard-navigation";
import type { Branch } from "@/lib/branches/types";
import type { ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";

const branches = [{ id: 1, code: "NY", name: "New York" }] as Branch[];
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
    amount: 25, refNumber: "", description: "", employeeId: 1, employeeName: "Maria",
    accountId: 2, accountName: "Expenses", sourceAccountId: 1, sourceAccountName: "Cash",
    paymentMethodId: 1, paymentMethodName: "CASH",
  }));
  return (
    <QueryClientProvider client={client}>
      <FormKeyboardNavigation />
      {transaction ? <>
        <DailyIncomeTransactionForm
          formId="transaction" transactionType={defaults.transactionType} initialValues={defaults}
          activeStep={step} onStepChange={setStep}
          onContinue={() => setStep(step === "assignment" ? "amounts" : step === "amounts" ? "payment" : "review")}
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
