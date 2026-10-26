"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { CloseoutRolloverDialog } from "@/components/accounting/closeout-rollover-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDailyIncomeMoney } from "@/lib/accounting/daily-income/display";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { withDefaultCashPaymentMethod, type DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import type { useDeliveryBalance } from "@/lib/deliveries/hooks/use-delivery-balance";
import type { PendingPaymentMethod } from "@/lib/deliveries/api/delivery-pending-payments-api";
import { toDopAmount } from "@/lib/deliveries/types";
import { formatActiveRouteRateLabel } from "@/lib/pickup-delivery-routes/display";
import { useTranslation } from "@/lib/i18n";

type BalanceState = ReturnType<typeof useDeliveryBalance>;

const METHOD_LABEL_KEYS: Record<PendingPaymentMethod, string> = {
  CHECK: "deliveries.wizard.balance.methods.check",
  ZELLE: "deliveries.wizard.balance.methods.zelle",
  DEPOSIT: "deliveries.wizard.balance.methods.deposit",
  "CREDIT-CARD": "deliveries.wizard.balance.methods.creditCard",
};

// Keep an in-progress payment intact when another user changes the balance.
// The mutation rechecks the current API balance before posting.
function DeliveryPaymentForm(props: ComponentProps<typeof DailyIncomeTransactionForm>) {
  const [initialValues] = useState(props.initialValues);
  return <DailyIncomeTransactionForm {...props} initialValues={initialValues} />;
}

function PendingPayments({ state, balance }: { state: BalanceState; balance: number }) {
  const { t } = useTranslation();
  const overrideId = useId();
  const payments = state.pending.data ?? [];
  if (state.pending.isError) return <div role="alert" className="space-y-3">
    <p className="text-sm">{t("deliveries.wizard.balance.pendingLoadError")}</p>
    <Button type="button" variant="outline" onClick={() => void state.pending.refetch()}>{t("deliveries.deliver.retry")}</Button>
  </div>;
  if (payments.length === 0) return null;
  return <div className="space-y-3 rounded-xl border border-input bg-muted p-4">
    <p className="text-sm font-medium">{t("deliveries.wizard.balance.pendingTitle")}</p>
    <ul className="space-y-1 text-sm">
      {payments.map((payment) => <li key={`${payment.method}:${payment.id}`} className="flex flex-wrap justify-between gap-2">
        <span>{t(METHOD_LABEL_KEYS[payment.method])}{payment.reference ? ` · ${payment.reference}` : ""}</span>
        <span className="tabular-nums">{formatInvoiceMoney(payment.amount)}</span>
      </li>)}
    </ul>
    <p className="flex justify-between gap-2 border-t border-input pt-2 text-sm font-medium">
      <span>{t("deliveries.wizard.balance.pendingTotal")}</span>
      <span className="tabular-nums">{formatInvoiceMoney(state.pendingTotal)}</span>
    </p>
    {state.canOverride ? <div className="space-y-3 rounded-lg border border-amber-500/60 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="flex items-start gap-2 text-sm font-medium">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("deliveries.wizard.balance.overrideWarning", { amount: formatInvoiceMoney(balance) })}
      </p>
      <label htmlFor={overrideId} className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          id={overrideId}
          type="checkbox"
          className="mt-0.5 size-4"
          checked={state.overrideAccepted}
          onChange={(event) => state.setOverrideAccepted(event.target.checked)}
        />
        <span>{t("deliveries.wizard.balance.overrideAccept")}</span>
      </label>
    </div> : <p className="text-sm">{t("deliveries.wizard.balance.pendingShort", { pending: formatInvoiceMoney(state.pendingTotal), balance: formatInvoiceMoney(balance) })}</p>}
  </div>;
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
        if (state.pending.isFetched) void state.pending.refetch();
      }}>{t("deliveries.wizard.balance.refresh")}</Button> : null}
    </div>
    {balance === 0 ? <p role="status" className="font-medium text-emerald-700 dark:text-emerald-400">{t("deliveries.wizard.balance.paid")}</p> : <>
      <p className="text-sm">{t("deliveries.wizard.balance.required")}</p>
      {state.recorded ? <p role="status" className="rounded-lg border border-input bg-accent p-3 text-sm">{t(state.recorded === "pending" ? "deliveries.wizard.balance.recordedPending" : "deliveries.wizard.balance.recorded")}</p> : null}
      {balance < 0 ? <p role="alert">{t("deliveries.wizard.balance.credit")}</p> : !state.canPay ? <p role="status">{t("deliveries.wizard.balance.paymentUnavailable")}</p> : <>
        <PendingPayments state={state} balance={balance} />
        {lookupError ? <div role="alert" className="space-y-3">
          <p>{t("deliveries.wizard.balance.paymentLoadError")}</p>
          <Button type="button" variant="outline" onClick={() => void Promise.all([state.profile, state.statement, state.employees, state.routes, state.banks, state.methods].filter((query) => query.isError).map((query) => query.refetch()))}>{t("deliveries.deliver.retry")}</Button>
        </div> : state.profile.isPending || (state.profile.data?.branch.id && state.statement.isPending) || state.methods.isPending ? <p role="status">{t("common.loading")}</p> : !statement ? <div className="space-y-3">
          <p role="status">{t(state.rate != null ? "deliveries.wizard.balance.noStatementCreate" : "deliveries.wizard.balance.noStatementNoRate")}</p>
          {state.rate != null ? <Button type="button" variant="outline" disabled={state.busy || !state.profile.data?.branch.id} onClick={()=>setRolloverOpen(true)}>
            {t(state.creatingStatement ? "deliveries.wizard.balance.creatingStatement" : "deliveries.wizard.balance.createStatement")}
          </Button> : null}
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
