"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { formatInventoryMinor } from "@/lib/inventory/display";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { DispatchReconciliationEntry } from "@/components/accounting/dispatch-reconciliation-entry";
import { ReconcileDispatchPayments } from "@/components/accounting/reconcile-dispatch-payments";
import { InventoryConfirmationDialog } from "@/components/inventory/inventory-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import { useAccountingPaymentMethods } from "@/lib/accounting/daily-income/hooks";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useConfirmReconciliation,
  useDispatchReconciliations,
  useReconcileDispatch,
  useRejectReconciliation,
} from "@/lib/inventory/pending-dispatches/hooks";
import { accountedQuantity, buildReconciliationInput, createReconciliationForm } from "@/lib/inventory/pending-dispatches/reconciliation";
import { creditMinor, paymentsTotalMinor, soldRevenueMinor, readOutcomeQuantity, reconciliationFormSchema, type ReconciliationFormValues } from "@/lib/inventory/pending-dispatches/schemas";
import {
  DAMAGE_RESOLUTIONS,
  LOSS_OUTCOMES,
  RECONCILIATION_OUTCOMES,
  type DispatchReconciliation,
  type PendingInventoryDispatch,
} from "@/lib/inventory/pending-dispatches/types";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";
import { cn } from "@/lib/utils";

export function ReconcileDispatchDialog({ dispatch, canReconcile, onClose, onBusyChange, guided = false }: {
  dispatch: PendingInventoryDispatch;
  canReconcile: boolean;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  guided?: boolean;
}) {
  const { t, locale } = useTranslation();
  const { hasPermission } = useAuth();
  const { notifySuccess, notifyError } = useFeedback();
  const { toErrorMessage } = useUserError();
  const canViewHistory = hasPermission(PERMISSIONS.inventoryDispatchesView.name, PERMISSIONS.inventoryDispatchesView.resourceType);
  const history = useDispatchReconciliations(canViewHistory ? dispatch.id : null);
  const reconcile = useReconcileDispatch();
  const confirmReconciliation = useConfirmReconciliation();
  const rejectReconciliation = useRejectReconciliation();
  const collectsSales = canReconcile && !dispatch.salesRecordedAtDispatch;
  const paymentMethods = useAccountingPaymentMethods(collectsSales);
  const bankAccounts = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, collectsSales);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [confirmationTarget, setConfirmationTarget] = useState<{ entry: DispatchReconciliation; action: ConfirmationActionOption } | null>(null);
  const form = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationFormSchema),
    defaultValues: createReconciliationForm(dispatch),
  });
  const lines = useWatch({ control: form.control, name: "lines" });
  const payments = useWatch({ control: form.control, name: "payments" });
  const errors = form.formState.errors;
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.pendingInventory.dialog.${key}`, values);
  const outcomeLabel = (outcome: string) => t(`accounting.pendingInventory.outcomes.${outcome}`);
  const itemNames = new Map(dispatch.lines.map((line) => [line.id, line.item.name]));
  const resolutionOptions = DAMAGE_RESOLUTIONS.map((value) => ({ value, label: t(`accounting.pendingInventory.resolutions.${value}`) }));
  const incomeOptions = dispatch.incomeRecipients.map((recipient) => {
    const roleKey = `accounting.pendingInventory.dialog.incomeRoles.${recipient.role}`;
    const role = t(roleKey);
    return { value: recipient.id, label: recipient.name, description: role === roleKey ? recipient.role : role };
  });
  const dateTime = (iso?: string) => iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
  const busy = form.formState.isSubmitting || reconcile.isPending;
  const confirmationPending = confirmReconciliation.isPending || rejectReconciliation.isPending;
  const anyPending = busy || confirmationPending;
  useEffect(() => {
    onBusyChange?.(anyPending);
  }, [anyPending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const nothingMessage = errors.lines?.message ?? errors.lines?.root?.message;
  const hasLoss = lines.some((line) => LOSS_OUTCOMES.some((outcome) => (readOutcomeQuantity(line[outcome]) ?? 0) > 0));
  const notesRequired = hasLoss || creditMinor({ lines, payments, salesRecordedAtDispatch: dispatch.salesRecordedAtDispatch }) > 0;

  const [step, setStep] = useState(1);
  const HistoryContainer = guided ? "details" : "section";
  const heading = useRef<HTMLHeadingElement>(null);
  const labels = ["inventoryItems", "inventoryPayment", "review"].map((key) => t(`accounting.dailyIncome.wizard.quickFlow.${key}`));
  useEffect(() => { if (guided) heading.current?.focus(); }, [guided, step]);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Validation is async, so a second submit can arrive before the mutation is pending.
    if (submitting.current) return;
    submitting.current = true;
    if (guided && step < 3) {
      try {
        const valid = await form.trigger(step === 1 ? ["lines"] : undefined, { shouldFocus: true });
        if (valid) setStep(step + 1);
        else if (step === 2 && form.getFieldState("lines").error) setStep(1);
      } finally { submitting.current = false; }
      return;
    }
    void form.handleSubmit(async (values) => {
      try {
        await reconcile.mutateAsync({ dispatchId: dispatch.id, input: buildReconciliationInput(values, requestId) });
        setRequestId(crypto.randomUUID());
        notifySuccess(text("saved"));
        onClose();
      } catch { /* The error stays visible and the request id is kept so a retry cannot reconcile twice. */ }
      finally { submitting.current = false; }
    }, (validationErrors) => {
      submitting.current = false;
      if (guided) setStep(validationErrors.lines ? 1 : 2);
    })(event);
  }

  async function submitConfirmation(action: ConfirmationActionOption, note: string) {
    if (!confirmationTarget) return;
    const command = { dispatchId: dispatch.id, reconciliation: confirmationTarget.entry, party: action.party, text: note };
    try {
      if (action.kind === "confirm") {
        await confirmReconciliation.mutateAsync(command);
        notifySuccess(t("inventory.confirmations.confirmed"));
      } else {
        await rejectReconciliation.mutateAsync(command);
        notifySuccess(t("inventory.confirmations.rejected"));
      }
      setConfirmationTarget(null);
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  function returnRemaining(index: number) {
    const line = form.getValues(`lines.${index}`);
    const remaining = line.outstanding - accountedQuantity(line);
    if (remaining <= 0) return;
    form.setValue(`lines.${index}.RETURNED`, String((readOutcomeQuantity(line.RETURNED) ?? 0) + remaining), { shouldDirty: true });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy && !confirmationPending) onClose(); }}>
      <DialogContent centerInWorkspace className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-7xl" aria-busy={busy}>
        <DialogHeader>
          <DialogTitle>{text("title")}</DialogTitle>
          <DialogDescription>{text("description", { holder: dispatch.holder.displayName, date: dateTime(dispatch.dispatchedAt) })}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:grid-cols-4">
          {([
            ["dispatched", dispatch.dispatchedQuantity],
            ["reconciled", dispatch.reconciledQuantity],
            ["awaiting", dispatch.awaitingConfirmationQuantity],
            ["outstanding", dispatch.outstandingQuantity],
          ] as const).map(([key, value]) => (
            <div key={key}><dt className="text-xs text-muted-foreground">{text(key)}</dt><dd className="text-base font-semibold">{value}</dd></div>
          ))}
        </dl>
        {canViewHistory ? <HistoryContainer aria-labelledby="dispatch-reconciliation-history" className={cn("space-y-2", guided && "rounded-lg border p-3")}>
          {guided ? <summary id="dispatch-reconciliation-history" className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{text("history")}</summary> : <h3 id="dispatch-reconciliation-history" className="text-sm font-medium">{text("history")}</h3>}
          {history.isError ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(history.error).message}</p>
            : history.isPending ? <p role="status" className="text-sm text-muted-foreground">{text("loadingHistory")}</p>
            : !history.data.length ? <p className="text-sm text-muted-foreground">{text("noHistory")}</p>
            : <ol className="space-y-2">{history.data.map((entry) => (
              <DispatchReconciliationEntry
                key={entry.id}
                entry={entry}
                itemNames={itemNames}
                formatDateTime={dateTime}
                disabled={confirmationPending}
                onAction={(target, action) => setConfirmationTarget({ entry: target, action })}
              />
            ))}</ol>}
        </HistoryContainer> : null}
        {!canReconcile ? <p role="status" className="text-sm text-muted-foreground">{text("readOnly")}</p> : lines.length ? (
          <form onSubmit={submit} className="space-y-4 border-t pt-4">
            {guided ? <div className="space-y-3"><TransactionWizardStepper step={step} labels={labels} disabled={busy} onSelectStep={setStep} /><header className="max-w-2xl space-y-2"><h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{labels[step - 1]}</h2><p className="text-sm leading-relaxed text-muted-foreground">{t(`accounting.dailyIncome.wizard.stepHints.${["inventoryItems", "inventoryPayment", "inventoryReview"][step - 1]}`)}</p></header></div> : null}
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", guided && step !== 2 && "hidden")}>
                <div className="space-y-2">
                  <Label htmlFor="reconcile-occurred-at">{text("occurredAt")}</Label>
                  <Input id="reconcile-occurred-at" type="datetime-local" aria-invalid={Boolean(errors.occurredAt)} {...form.register("occurredAt")} />
                  {errors.occurredAt?.message ? <p role="alert" className="text-xs text-destructive">{t(errors.occurredAt.message)}</p> : null}
                </div>
                {collectsSales && incomeOptions.length ? (
                  <div className="space-y-2">
                    <Label htmlFor="reconcile-income-employee">{text("incomeEmployee")}</Label>
                    <Controller control={form.control} name="incomeEmployeeId" render={({ field }) => (
                      <SearchableSelect inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined} id="reconcile-income-employee" options={incomeOptions} value={field.value} onValueChange={field.onChange} placeholder={text("selectIncomeEmployee")} searchPlaceholder={text("searchEmployees")} emptyMessage={text("noEmployees")} aria-invalid={Boolean(errors.incomeEmployeeId)} mobileSheet />
                    )} />
                    {errors.incomeEmployeeId?.message ? <p role="alert" className="text-xs text-destructive">{t(errors.incomeEmployeeId.message)}</p> : null}
                  </div>
                ) : null}
                <div className={cn("space-y-2 sm:col-span-2", collectsSales && incomeOptions.length > 0 && "lg:col-span-1")}>
                  <Label htmlFor="reconcile-notes">{text("notes")}</Label>
                  <Input id="reconcile-notes" maxLength={1000} aria-invalid={Boolean(errors.notes)} aria-describedby="reconcile-notes-hint" {...form.register("notes")} />
                  <p id="reconcile-notes-hint" className={cn("text-xs", notesRequired ? "text-foreground" : "text-muted-foreground")}>{text("notesHint")}</p>
                  {errors.notes?.message ? <p role="alert" className="text-xs text-destructive">{t(errors.notes.message)}</p> : null}
                </div>
              </div>
              {dispatch.salesRecordedAtDispatch ? <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{text("salesRecorded")}</p> : null}
              <div className={cn("grid gap-4 xl:grid-cols-2", guided && step !== 1 && "hidden")}>
              {lines.map((line, index) => {
                const remaining = line.outstanding - accountedQuantity(line);
                const lineErrors = errors.lines?.[index];
                const sold = (readOutcomeQuantity(line.SOLD) ?? 0) > 0;
                const damaged = (readOutcomeQuantity(line.DAMAGED) ?? 0) > 0;
                const messages = [...new Set([
                  ...RECONCILIATION_OUTCOMES.map((outcome) => lineErrors?.[outcome]?.message),
                  lineErrors?.outstanding?.message, lineErrors?.revenue?.message, lineErrors?.damageResolution?.message,
                ].filter((message): message is string => Boolean(message)))];
                return <fieldset key={line.dispatchLineId} className="min-w-0 space-y-3 rounded-lg border p-3">
                  <legend className="sr-only">{line.itemName}</legend>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{line.itemName}</p>
                      <p className={cn("text-xs", remaining < 0 ? "text-destructive" : "text-muted-foreground")}>{text("lineSummary", { outstanding: line.outstanding, remaining })}</p>
                    </div>
                    {remaining > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => returnRemaining(index)}>{text("returnRemaining")}</Button> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {RECONCILIATION_OUTCOMES.map((outcome) => <div key={outcome} className="space-y-1">
                      <Label htmlFor={`reconcile-${index}-${outcome}`} className="text-xs">{outcomeLabel(outcome)}</Label>
                      <Input id={`reconcile-${index}-${outcome}`} type="number" inputMode="numeric" min={0} step={1} aria-invalid={Boolean(lineErrors?.[outcome])} {...form.register(`lines.${index}.${outcome}`)} />
                    </div>)}
                  </div>
                  {(sold && collectsSales) || damaged ? <div className="grid gap-3 sm:grid-cols-2">
                    {sold && collectsSales ? <div className="space-y-1">
                      <Label htmlFor={`reconcile-${index}-revenue`} className="text-xs">{text("revenue")}</Label>
                      <Input id={`reconcile-${index}-revenue`} inputMode="decimal" placeholder="0.00" aria-invalid={Boolean(lineErrors?.revenue)} {...form.register(`lines.${index}.revenue`)} />
                    </div> : null}
                    {damaged ? <div className="space-y-1">
                      <Label htmlFor={`reconcile-${index}-resolution`} className="text-xs">{text("damageResolution")}</Label>
                      <Controller control={form.control} name={`lines.${index}.damageResolution`} render={({ field }) => (
                        <SearchableSelect inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined} id={`reconcile-${index}-resolution`} options={resolutionOptions} value={field.value} onValueChange={field.onChange} placeholder={text("selectResolution")} searchPlaceholder={text("searchResolutions")} emptyMessage={text("noResolutions")} aria-invalid={Boolean(lineErrors?.damageResolution)} mobileSheet />
                      )} />
                    </div> : null}
                  </div> : null}
                  {messages.map((message) => <p key={message} role="alert" className="text-xs text-destructive">{t(message)}</p>)}
                </fieldset>;
              })}
              </div>
              <div hidden={guided && step !== 2}>
              {collectsSales ? (
                <ReconcileDispatchPayments
                  inlineOptionsLimit={guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined}
                  form={form}
                  paymentMethods={paymentMethods.data ?? []}
                  bankAccounts={bankAccounts.data?.items ?? []}
                  loading={paymentMethods.isLoading || bankAccounts.isLoading}
                />
              ) : null}
              </div>
              {guided && step === 3 ? <div className="space-y-4 rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.wizard.workflow.reviewHint")}</p>
                {lines.filter((line) => accountedQuantity(line) > 0).map((line) => <section key={line.dispatchLineId} className="space-y-2">
                  <h3 className="text-sm font-semibold">{line.itemName}</h3>
                  <dl className="flex flex-wrap gap-4">{RECONCILIATION_OUTCOMES.filter((outcome) => (readOutcomeQuantity(line[outcome]) ?? 0) > 0).map((outcome) => <div key={outcome}><dt className="text-xs text-muted-foreground">{outcomeLabel(outcome)}</dt><dd className="text-sm font-medium">{line[outcome]}</dd></div>)}</dl>
                </section>)}
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">{text("occurredAt")}</dt><dd className="text-sm font-medium">{form.getValues("occurredAt")}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">{text("incomeEmployee")}</dt><dd className="text-sm font-medium">{incomeOptions.find((option) => option.value === form.getValues("incomeEmployeeId"))?.label || t("common.empty.dash")}</dd></div>
                  {collectsSales ? <><div><dt className="text-xs text-muted-foreground">{text("revenue")}</dt><dd className="text-sm font-medium">{formatInventoryMinor(soldRevenueMinor(lines))}</dd></div><div><dt className="text-xs text-muted-foreground">{text("payments")}</dt><dd className="text-sm font-medium">{formatInventoryMinor(paymentsTotalMinor(payments))}</dd></div></> : null}
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{text("notes")}</dt><dd className="whitespace-pre-wrap break-words text-sm font-medium">{form.getValues("notes") || t("common.empty.dash")}</dd></div>
                </dl>
                {payments.map((payment) => <p key={payment.key} className="text-sm">{payment.paymentMethodName} · {payment.amount}{payment.checkNumber ? ` · ${payment.checkNumber}` : ""}</p>)}
              </div> : null}
            </fieldset>
            {nothingMessage ? <p role="alert" className="text-sm text-destructive">{t(nothingMessage)}</p> : null}
            {reconcile.isError ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(reconcile.error).message}</p> : null}
            <p className="text-xs text-muted-foreground">{t("inventory.confirmations.reconciliation.final")}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {guided && step > 1 ? <Button type="button" variant="outline" className="sm:mr-auto" disabled={busy} onClick={() => setStep(step - 1)}>{t("common.actions.previous")}</Button> : null}
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common.actions.cancel")}</Button>
              <Button type="submit" disabled={busy}>{busy ? text("saving") : guided && step < 3 ? t("common.actions.next") : text("save")}</Button>
            </div>
          </form>
        ) : null}
        <InventoryConfirmationDialog
          action={confirmationTarget?.action ?? null}
          subject="reconciliation"
          description={confirmationTarget
            ? t(confirmationTarget.action.kind === "reject"
              ? "inventory.confirmations.reconciliation.reject"
              : `inventory.confirmations.reconciliation.${confirmationTarget.action.party}`)
            : ""}
          note={confirmationTarget?.action.kind === "confirm" ? t("inventory.confirmations.reconciliation.final") : undefined}
          isPending={confirmationPending}
          onSubmit={submitConfirmation}
          onOpenChange={(open) => !open && setConfirmationTarget(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
