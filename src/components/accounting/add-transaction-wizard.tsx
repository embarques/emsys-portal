"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccountingLookup, ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

type SharedProps = {
  open: boolean;
  employees: Employee[];
  accounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: DailyIncomeJournalValues) => void;
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
  return { transactionType: type, amount: 0, refNumber: "", description: "" };
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

export function AddTransactionWizard(props: Props) {
  const formId = useId();
  const isEdit = props.mode === "edit";
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [selectedType, setSelectedType] = useState<JournalTransactionType | null>(
    isEdit ? props.initialValues.transactionType : null,
  );
  const [detailValues, setDetailValues] = useState<DailyIncomeJournalValues>(
    isEdit ? props.initialValues : emptyTransaction("INITIAL-PAYMENT"),
  );

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
    setDetailValues(emptyTransaction("INITIAL-PAYMENT"));
  }, [props.open, isEdit, isEdit ? props.initialValues : null]);

  function handleTypeChange(type: JournalTransactionType) {
    setSelectedType(type);
    setDetailValues((current) => clearTypeSpecificFields(current, type));
  }

  function handleBack() {
    setStep(1);
  }

  function handleNext() {
    if (!selectedType) return;
    setDetailValues((current) => clearTypeSpecificFields(current, selectedType));
    setStep(2);
  }

  return (
    <div className="flex max-h-[90vh] flex-col">
      <DialogHeader className="shrink-0 space-y-4 border-b border-border px-6 py-4 pr-12">
        <div>
          <DialogTitle>{isEdit ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>Record an entry in the selected daily closeout.</DialogDescription>
        </div>
        <TransactionWizardStepper step={step} />
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {step === 1 ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TransactionTypeSelector value={selectedType} onChange={handleTypeChange} />
          </div>
        ) : null}

        {selectedType ? (
          <div className={cn("min-h-0 flex-1 flex-col", step === 2 ? "flex" : "hidden")}>
            <DailyIncomeTransactionForm
              key={`${selectedType}-${isEdit ? props.initialValues.transactionType : "add"}`}
              formId={formId}
              transactionType={selectedType}
              initialValues={detailValues}
              employees={props.employees}
              accounts={props.accounts}
              invoices={props.invoices}
              paymentMethods={props.paymentMethods}
              showTypeSummary={!isEdit}
              onSubmit={props.onSubmit}
            />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-3">
        {step === 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleNext} disabled={!selectedType || props.isSubmitting}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center">
              {!isEdit ? (
                <Button type="button" variant="outline" onClick={handleBack} disabled={props.isSubmitting}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              ) : (
                <span className="flex-1" aria-hidden />
              )}
              {props.error ? (
                <p className="ml-3 min-w-0 truncate text-sm text-destructive">{props.error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" onClick={props.onCancel} disabled={props.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={props.isSubmitting}>
                <Save className="size-4" />
                {props.isSubmitting ? "Saving…" : "Save transaction"}
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
