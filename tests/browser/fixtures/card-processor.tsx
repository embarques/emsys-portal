import { createRoot } from "react-dom/client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { dailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import { createDailyIncomeJournal } from "@/lib/accounting/daily-income/api";
import type { ChartAccount, DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

const bank = { id: 82, name: "Operating bank", displayName: "Operating bank", type: "BANK" } as ChartAccount;
const methods = [{ id: 1, name: "CASH" }, { id: 4, name: "ZELLE" }, { id: 5, name: "CREDIT-CARD" }];
function Fixture() {
  const form = useForm<DailyIncomeJournalValues>({ resolver: zodResolver(dailyIncomeJournalSchema), defaultValues: {
    transactionType: "INITIAL-PAYMENT", amount: 80, invoiceCost: 100, invoiceDiscount: 20,
    invoiceNumber: "0042", refNumber: "", description: "", paymentMethodId: 4, paymentMethodName: "ZELLE",
    paymentAccountId: 82, paymentAccountName: "Operating bank", paymentAccountType: "BANK",
  } });
  const values = useWatch({ control: form.control });
  return <form onSubmit={form.handleSubmit(async values => {
    await createDailyIncomeJournal({ id: 1, status: "OPEN", branch: { id: 2, name: "NY" }, currency: "USD", rate: 1, date: "2026-11-20" }, values);
  })}>
    <RegisterInvoiceTransactionFields employees={[]} bankAccounts={[bank]} paymentMethods={methods}
      register={form.register} watch={form.watch} setValue={form.setValue} trigger={form.trigger} clearErrors={form.clearErrors}
      errors={form.formState.errors} activeStep="payment" showEmployee={false} showParties={false} showInvoiceNumber={false} />
    <button type="submit">Save card receipt</button>
    <output id="values">{JSON.stringify(values)}</output>
    <output id="posted" />
    <output id="errors">{JSON.stringify(Object.keys(form.formState.errors))}</output>
  </form>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
