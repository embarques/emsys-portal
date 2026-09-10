"use client";

import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findCashPaymentMethod, withDefaultCashPaymentMethod, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

type SharedProps = {
  open: boolean;
  presentation?: "dialog" | "tab";
  appearance?: "default" | "phone";
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  accounts: ChartAccount[];
  bankAccounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: DailyIncomeJournalValues) => void | Promise<void>;
  onCancel: () => void;
};

type AddModeProps = SharedProps & {
  mode: "add";
  initialValues?: never;
};

type EditModeProps = SharedProps & {
  mode: "edit";
  initialValues: DailyIncomeJournalValues;
};

type Props = AddModeProps | EditModeProps;

function emptyTransaction(
  type: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  return withDefaultCashPaymentMethod(
    {
      transactionType: type,
      refNumber: "",
      description: "",
      includeSender: false,
      includeReceiver: false,
    },
    paymentMethods,
  );
}

function continueTransactionValues(
  type: JournalTransactionType,
  values: DailyIncomeJournalValues,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  return {
    ...emptyTransaction(type, paymentMethods),
    employeeId: values.employeeId,
    employeeName: values.employeeName,
    employeeGroupId: values.employeeGroupId,
    employeeGroupName: values.employeeGroupName,
    assigneeSource: values.assigneeSource,
    routeId: values.routeId,
    routeName: values.routeName,
    routeCrewId: values.routeCrewId,
    routeCrewName: values.routeCrewName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
    transactionType: type,
  };
}

function clearTypeSpecificFields(
  values: DailyIncomeJournalValues,
  nextType: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  if (values.transactionType === nextType) {
    return withDefaultCashPaymentMethod({ ...values, transactionType: nextType }, paymentMethods);
  }

  return emptyTransaction(nextType, paymentMethods);
}

export function AddTransactionWizard(props: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const presentation = props.presentation ?? "dialog";
  const appearance = props.appearance ?? "default";
  const isPhone = appearance === "phone";
  const isEdit = props.mode === "edit";
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [selectedType, setSelectedType] = useState<JournalTransactionType | null>(
    isEdit ? props.initialValues.transactionType : null,
  );
  const [detailValues, setDetailValues] = useState<DailyIncomeJournalValues>(
    isEdit ? props.initialValues : emptyTransaction("INITIAL-PAYMENT", props.paymentMethods),
  );
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [focusSecondFieldSignal, setFocusSecondFieldSignal] = useState(0);
  const stepLabel = step === 1
    ? t("accounting.dailyIncome.wizard.steps.selectType")
    : t("accounting.dailyIncome.wizard.steps.enterDetails");
  const title = isEdit
    ? t("accounting.dailyIncome.wizard.editTitle")
    : t("accounting.dailyIncome.wizard.addTitle");

  useEffect(() => {
    if (!props.open) return;

    if (isEdit) {
      setStep(2);
      setSelectedType(props.initialValues.transactionType);
      setDetailValues(props.initialValues);
      return;
    }

    setStep(1);
    setSelectedType(null);
    setDetailValues(emptyTransaction("INITIAL-PAYMENT", props.paymentMethods));
    setFormSessionKey(0);
    setFocusSecondFieldSignal(0);
  }, [props.open, isEdit, isEdit ? props.initialValues : null]);

  useEffect(() => {
    if (!props.open || isEdit) return;
    const cash = findCashPaymentMethod(props.paymentMethods);
    if (!cash) return;
    setDetailValues((current) => withDefaultCashPaymentMethod(current, props.paymentMethods));
  }, [isEdit, props.open, props.paymentMethods]);

  async function handleFormSubmit(values: DailyIncomeJournalValues) {
    try {
      await props.onSubmit(values);
      if (!isEdit && selectedType) {
        setDetailValues(continueTransactionValues(selectedType, values, props.paymentMethods));
        setFormSessionKey((key) => key + 1);
        setFocusSecondFieldSignal((signal) => signal + 1);
      }
    } catch {
      // Parent surfaces API/validation errors via props.error.
    }
  }

  function handleTypeChange(type: JournalTransactionType) {
    setSelectedType(type);
    setDetailValues((current) => clearTypeSpecificFields(current, type, props.paymentMethods));
  }

  function handleBack() {
    setStep(1);
  }

  function handleNext() {
    if (!selectedType) return;
    setDetailValues((current) => clearTypeSpecificFields(current, selectedType, props.paymentMethods));
    setStep(2);
  }

  return (
    <div
      data-testid="transaction-wizard"
      className={cn(
        "flex min-w-0 flex-col overflow-x-hidden",
        presentation === "dialog" ? "max-h-[90vh]" : "min-h-0 flex-1",
        isPhone && "h-full max-h-[100dvh] bg-background",
      )}
    >
      {presentation === "dialog" && isPhone ? (
        <DialogHeader className="shrink-0 space-y-4 border-b border-primary/20 bg-primary px-4 pb-4 pt-5 text-primary-foreground">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <DialogTitle className="min-w-0 truncate text-2xl font-bold text-primary-foreground">
              {step === 2 && selectedType ? t(`accounting.dailyIncome.transactionTypes.${selectedType === "INITIAL-PAYMENT" ? "initialPayment" : selectedType.toLowerCase()}.shortLabel`) : title}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-4 text-base font-semibold">
              <span>{t("accounting.dailyIncome.wizard.stepCount", { current: step, total: 2 })}</span>
              <button type="button" className="text-primary-foreground" onClick={props.onCancel}>
                {t("common.actions.cancel")}
              </button>
            </div>
          </div>
          <DialogDescription className="sr-only">{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/85">{stepLabel}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
              <div
                className="h-full rounded-full bg-primary-foreground transition-[width]"
                style={{ width: step === 1 ? "50%" : "100%" }}
              />
            </div>
          </div>
        </DialogHeader>
      ) : presentation === "dialog" ? (
        <DialogHeader
          className={cn(
            "shrink-0 space-y-4 border-b border-border px-6 py-4 pr-12",
          )}
        >
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
          </div>
          <TransactionWizardStepper step={step} appearance={appearance} />
        </DialogHeader>
      ) : (
        <div className="shrink-0 border-b border-border px-5 py-3">
          <TransactionWizardStepper step={step} appearance={appearance} />
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {step === 1 ? (
          <div className={cn("flex-1 overflow-y-auto px-6 py-5", isPhone && "overflow-x-hidden px-4 py-4")}>
            <TransactionTypeSelector value={selectedType} onChange={handleTypeChange} appearance={appearance} />
          </div>
        ) : null}

        {selectedType ? (
          <div className={cn("relative min-h-0 min-w-0 flex-1 flex-col", step === 2 ? "flex" : "hidden")}>
            {props.isSubmitting && step === 2 ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {t("accounting.dailyIncome.wizard.saving")}
                </div>
              </div>
            ) : null}
            <DailyIncomeTransactionForm
              key={`${selectedType}-${isEdit ? props.initialValues.transactionType : `add-${formSessionKey}`}`}
              formId={formId}
              transactionType={selectedType}
              initialValues={detailValues}
              employees={props.employees}
              dailyRoutes={props.dailyRoutes}
              statementDate={props.statementDate}
              accounts={props.accounts}
              bankAccounts={props.bankAccounts}
              invoices={props.invoices}
              paymentMethods={props.paymentMethods}
              showTypeSummary={!isEdit}
              appearance={appearance}
              focusSecondFieldSignal={!isEdit ? focusSecondFieldSignal : undefined}
              onSubmit={handleFormSubmit}
            />
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-card",
          presentation === "dialog" ? "px-6 py-3" : "px-5 py-3",
          isPhone && "pb-[calc(env(safe-area-inset-bottom)+0.75rem)] px-4 py-3",
        )}
      >
        {step === 1 ? (
          <div className={cn("flex items-center justify-between gap-3", isPhone && "grid grid-cols-2")}>
            <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.isSubmitting} className={cn(isPhone && "h-12 rounded-xl text-base")}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" onClick={handleNext} disabled={!selectedType || props.isSubmitting} className={cn(isPhone && "h-12 rounded-xl text-base")}>
              {t("common.actions.next")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className={cn("flex items-center justify-between gap-3", isPhone && "flex-col items-stretch")}>
            <div className="flex min-w-0 flex-1 items-center">
              {!isEdit ? (
                <Button type="button" variant="outline" onClick={handleBack} disabled={props.isSubmitting} className={cn(isPhone && "hidden")}>
                  <ArrowLeft className="size-4" />
                  {t("common.actions.previous")}
                </Button>
              ) : (
                <span className="flex-1" aria-hidden />
              )}
              {props.error && !isPhone ? (
                <p className="ml-3 min-w-0 truncate text-sm text-destructive">{props.error}</p>
              ) : null}
            </div>
            {props.error && isPhone ? (
              <p className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {props.error}
              </p>
            ) : null}
            <div className={cn("flex shrink-0 items-center gap-2", isPhone && "grid grid-cols-2")}>
              <Button type="button" variant="outline" onClick={isPhone && !isEdit ? handleBack : props.onCancel} disabled={props.isSubmitting} className={cn(isPhone && "h-12 rounded-xl text-base")}>
                {isPhone && !isEdit ? (
                  <>
                    <ArrowLeft className="size-4" />
                    {t("common.actions.previous")}
                  </>
                ) : (
                  t("common.actions.cancel")
                )}
              </Button>
              <Button type="submit" form={formId} disabled={props.isSubmitting} className={cn(isPhone && "h-12 rounded-xl text-base")}>
                {props.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {props.isSubmitting ? t("common.actions.saving") : t("accounting.dailyIncome.wizard.saveTransaction")}
              </Button>
            </div>
          </div>
        )}
        {step === 1 && props.error ? (
          <p className="mt-2 text-sm text-destructive">{props.error}</p>
        ) : null}
      </div>
    </div>
  );
}
