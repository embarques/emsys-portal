"use client";

import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccountingLookup, ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SharedProps = {
  open: boolean;
  presentation?: "dialog" | "tab";
  appearance?: "default" | "phone";
  employees: Employee[];
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

function emptyTransaction(type: JournalTransactionType): DailyIncomeJournalValues {
  return {
    transactionType: type,
    refNumber: "",
    description: "",
    includeSender: false,
    includeReceiver: false,
  };
}

function continueTransactionValues(
  type: JournalTransactionType,
  values: DailyIncomeJournalValues,
): DailyIncomeJournalValues {
  return {
    ...emptyTransaction(type),
    employeeId: values.employeeId,
    employeeName: values.employeeName,
    employeeGroupId: values.employeeGroupId,
    employeeGroupName: values.employeeGroupName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
    transactionType: type,
  };
}

function clearTypeSpecificFields(
  values: DailyIncomeJournalValues,
  nextType: JournalTransactionType,
): DailyIncomeJournalValues {
  if (values.transactionType === nextType) {
    return { ...values, transactionType: nextType };
  }

  return emptyTransaction(nextType);
}

function isTextEntryTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;

  return !["button", "checkbox", "radio", "submit", "reset", "hidden"].includes(target.type);
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
    isEdit ? props.initialValues : emptyTransaction("INITIAL-PAYMENT"),
  );
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [focusSecondFieldSignal, setFocusSecondFieldSignal] = useState(0);
  const [isPhoneFieldFocused, setIsPhoneFieldFocused] = useState(false);

  useEffect(() => {
    if (!props.open) return;

    if (isEdit) {
      setStep(2);
      setSelectedType(props.initialValues.transactionType);
      setDetailValues(props.initialValues);
      setIsPhoneFieldFocused(false);
      return;
    }

    setStep(1);
    setSelectedType(null);
    setDetailValues(emptyTransaction("INITIAL-PAYMENT"));
    setFormSessionKey(0);
    setFocusSecondFieldSignal(0);
    setIsPhoneFieldFocused(false);
  }, [props.open, isEdit, isEdit ? props.initialValues : null]);

  async function handleFormSubmit(values: DailyIncomeJournalValues) {
    try {
      await props.onSubmit(values);
      if (!isEdit && selectedType) {
        setDetailValues(continueTransactionValues(selectedType, values));
        setFormSessionKey((key) => key + 1);
        setFocusSecondFieldSignal((signal) => signal + 1);
      }
    } catch {
      // Parent surfaces API/validation errors via props.error.
    }
  }

  function handleTypeChange(type: JournalTransactionType) {
    setSelectedType(type);
    setDetailValues((current) => clearTypeSpecificFields(current, type));
  }

  function handleBack() {
    setIsPhoneFieldFocused(false);
    setStep(1);
  }

  function handleNext() {
    if (!selectedType) return;
    setIsPhoneFieldFocused(false);
    setDetailValues((current) => clearTypeSpecificFields(current, selectedType));
    setStep(2);
  }

  return (
    <div
      data-testid="transaction-wizard"
      onFocusCapture={(event) => {
        if (isPhone && isTextEntryTarget(event.target)) {
          setIsPhoneFieldFocused(true);
        }
      }}
      onBlurCapture={() => {
        if (!isPhone) return;
        window.setTimeout(() => {
          setIsPhoneFieldFocused(isTextEntryTarget(document.activeElement));
        }, 0);
      }}
      className={cn(
        "flex min-w-0 flex-col overflow-x-hidden",
        presentation === "dialog" ? "max-h-[90vh]" : "min-h-0 flex-1",
        isPhone && "h-full max-h-[100dvh] bg-background",
      )}
    >
      {presentation === "dialog" ? (
        <DialogHeader
          className={cn(
            "shrink-0 space-y-4 border-b border-border px-6 py-4 pr-12",
            isPhone && "space-y-3 px-4 pb-4 pt-5 pr-12",
          )}
        >
          <div>
            <DialogTitle className={cn(isPhone && "text-2xl")}>
              {isEdit
                ? t("accounting.dailyIncome.wizard.editTitle")
                : t("accounting.dailyIncome.wizard.addTitle")}
            </DialogTitle>
            <DialogDescription className={cn(isPhone && "text-base")}>{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
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
          isPhone && step === 2 && isPhoneFieldFocused && "hidden",
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
              {props.error ? (
                <p className="ml-3 min-w-0 truncate text-sm text-destructive">{props.error}</p>
              ) : null}
            </div>
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
