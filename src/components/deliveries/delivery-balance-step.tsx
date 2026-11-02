"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { CloseoutRolloverDialog } from "@/components/accounting/closeout-rollover-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { withDefaultCashPaymentMethod, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { useDeliveryBalance } from "@/lib/deliveries/hooks/use-delivery-balance";
import { toDopAmount } from "@/lib/deliveries/types";
import { formatActiveRouteRateLabel } from "@/lib/pickup-delivery-routes/display";
import { useTranslation } from "@/lib/i18n";

type BalanceState = ReturnType<typeof useDeliveryBalance>;

// Keep an in-progress payment intact when another user changes the balance.
// The mutation rechecks the current API balance before posting.
function DeliveryPaymentForm(props: ComponentProps<typeof DailyIncomeTransactionForm>) {
  const [initialValues] = useState(props.initialValues);
  return <DailyIncomeTransactionForm {...props} initialValues={initialValues} />;
}

export function DeliveryBalanceStep({ state }: { state: BalanceState }) {
  const { t } = useTranslation();
  const formId = useId();
  const [rolloverOpen,setRolloverOpen]=useState(false);
  const invoice = state.invoice.data;
  const statement = state.statement.data;
  const initialValues = useMemo<DailyIncomeJournalValues>(() => withDefaultCashPaymentMethod<DailyIncomeJournalValues>({
    transactionType: "PAYMENT", amount: Math.max(0, invoice?.balance ?? 0),
    invoiceId: invoice?.invoiceId, invoiceNumber: invoice?.invoiceNumber,
    invoiceBalance: invoice?.balance, refNumber: "", refNumberMode: "system", description: "",
  }, state.methods.data ?? []), [invoice?.balance, invoice?.invoiceId, invoice?.invoiceNumber, state.methods.data]);
  if (state.invoice.isPending) return <p role="status">{t("common.loading")}</p>;
  if (state.invoice.isError || !invoice) return <div role="alert" className="space-y-3">
    <p>{t("deliveries.wizard.balance.loadError")}</p>
    <Button type="button" variant="outline" onClick={() => void state.invoice.refetch()}>{t("deliveries.deliver.retry")}</Button>
  </div>;
  const balance = invoice.balance ?? 0;
  const dop = toDopAmount(balance, state.rate);
  const lookupError = state.profile.isError || state.statement.isError || state.employees.isError || state.routes.isError || state.banks.isError || state.methods.isError;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input bg-muted p-4">
      <div>
        <p className="text-sm text-muted-foreground">{t("deliveries.wizard.balance.outstanding")}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatInvoiceMoney(balance)}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {dop != null
            ? t("deliveries.wizard.balance.dopAtRate", { amount: formatDailyIncomeMoney(dop, "DOP"), rate: formatActiveRouteRateLabel({ rate: state.rate }) })
            : t("deliveries.wizard.balance.rateUnavailable")}
        </p>
      </div>
      {balance !== 0 ? <Button type="button" variant="outline" disabled={state.invoice.isFetching || state.busy} onClick={() => {
        void state.invoice.refetch();
        if (state.canPay && state.profile.data?.branch.id) void state.statement.refetch();
      }}>{t("deliveries.wizard.balance.refresh")}</Button> : null}
    </div>
    {balance === 0 ? <p role="status" className="font-medium text-emerald-700 dark:text-emerald-400">{t("deliveries.wizard.balance.paid")}</p> : <>
      <p className="text-sm">{t("deliveries.wizard.balance.required")}</p>
      {state.recorded ? <p role="status" className="rounded-lg border border-input bg-accent p-3 text-sm">{t(state.recorded === "pending" ? "deliveries.wizard.balance.recordedPending" : "deliveries.wizard.balance.recorded")}</p> : null}
      {balance < 0 ? <p role="alert">{t("deliveries.wizard.balance.credit")}</p> : !state.canPay ? <p role="status">{t("deliveries.wizard.balance.paymentUnavailable")}</p> : <>
        {lookupError ? <div role="alert" className="space-y-3">
          <p>{t("deliveries.wizard.balance.paymentLoadError")}</p>
          <Button type="button" variant="outline" onClick={() => void Promise.all([state.profile, state.statement, state.employees, state.routes, state.banks, state.methods].filter((query) => query.isError).map((query) => query.refetch()))}>{t("deliveries.deliver.retry")}</Button>
        </div> : state.profile.isPending || (state.profile.data?.branch.id && state.statement.isPending) || state.methods.isPending ? <p role="status">{t("common.loading")}</p> : !statement ? <div className="space-y-3">
          <p role="status">{t("deliveries.wizard.balance.noStatementCreate")}</p>
          <Button type="button" variant="outline" disabled={state.busy || !state.profile.data?.branch.id} onClick={()=>setRolloverOpen(true)}>
            {t(state.creatingStatement ? "deliveries.wizard.balance.creatingStatement" : "deliveries.wizard.balance.createStatement")}
          </Button>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        </div> : statement.status !== "OPEN" ? <p role="status">{t("deliveries.wizard.balance.statementClosed")}</p> : <>
          <fieldset disabled={state.busy} className="min-w-0">
            <DeliveryPaymentForm
              key={`${invoice.invoiceId}:${statement.id}`}
              formId={formId} transactionType="PAYMENT" initialValues={initialValues}
              employees={state.employees.data?.items ?? []} dailyRoutes={state.routes.data?.items ?? []}
              statementDate={statement.date} statementBranchId={statement.branch?.id}
              accounts={[]} bankAccounts={state.banks.data?.items ?? []} invoices={[invoice]}
              paymentMethods={state.methods.data ?? []} allowAutoClear onSubmit={state.pay}
            />
            <Button type="submit" form={formId} className="mt-4" disabled={state.busy}>{t(state.busy ? "common.actions.saving" : "deliveries.wizard.balance.recordPayment")}</Button>
          </fieldset>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        </>}
      </>}
    </>}
    {rolloverOpen ? <CloseoutRolloverDialog open={rolloverOpen} onOpenChange={setRolloverOpen} onReady={async()=>{await state.statement.refetch();}} /> : null}
    <Dialog open={Boolean(state.confirmation.pendingValues)} onOpenChange={(open) => { if (!open) state.confirmation.respond(false); }}>
      <DialogContent centerInWorkspace>
        <DialogHeader><DialogTitle>{t("accounting.dailyIncome.duplicatePayment.title")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.duplicatePayment.description")}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => state.confirmation.respond(false)}>{t("accounting.dailyIncome.duplicatePayment.review")}</Button>
          <Button type="button" onClick={() => state.confirmation.respond(true)}>{t("accounting.dailyIncome.duplicatePayment.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
