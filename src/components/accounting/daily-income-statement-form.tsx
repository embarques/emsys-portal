"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createDailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import type { DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import type { Branch } from "@/lib/branches/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  branches: Branch[];
  initialValues: DailyIncomeStatementValues;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: DailyIncomeStatementValues) => void;
  onCancel: () => void;
};

export function DailyIncomeStatementForm({ branches, initialValues, isSubmitting, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const schema = useMemo(
    () =>
      createDailyIncomeStatementSchema({
        dateRequired: t("accounting.dailyIncome.form.validation.dateRequired"),
        branchRequired: t("accounting.dailyIncome.form.validation.branchRequired"),
        currencyRequired: t("accounting.dailyIncome.form.validation.currencyRequired"),
        rateNonNegative: t("accounting.dailyIncome.form.validation.rateNonNegative"),
      }),
    [t],
  );
  const currencyOptions = useMemo(
    () => [
      { value: "USD", label: t("accounting.dailyIncome.currency.usd") },
      { value: "DOP", label: t("accounting.dailyIncome.currency.dop") },
    ],
    [t],
  );
  const { formState: { errors }, handleSubmit, register, reset, setValue, watch } = useForm<DailyIncomeStatementValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => reset(initialValues), [initialValues, reset]);
  const branchId = watch("branchId");
  const currency = watch("currency");
  const showExchangeRate = currency?.trim().toUpperCase() === "DOP";
  const branchOptions = branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} — ${branch.name}`, keywords: [branch.code, branch.name] }));

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="min-w-0 space-y-5 max-md:[&_button]:h-12 max-md:[&_button]:rounded-xl max-md:[&_input]:h-12 max-md:[&_input]:rounded-xl max-md:[&_input]:text-base max-md:[&_label]:text-base"
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="relative z-20 space-y-2">
          <Label htmlFor="statement-branch">{t("accounting.dailyIncome.statement.fields.branch")}</Label>
          <SearchableSelect
            id="statement-branch"
            value={branchId ? String(branchId) : ""}
            onValueChange={(next) => {
              const branch = branches.find((item) => item.id === Number(next));
              setValue("branchId", branch?.id ?? 0, { shouldValidate: true });
              setValue("branchCode", branch?.code ?? "", { shouldValidate: true });
              setValue("branchName", branch?.name ?? "", { shouldValidate: true });
            }}
            options={branchOptions}
            placeholder={t("accounting.dailyIncome.statement.placeholders.selectBranch")}
            searchPlaceholder={t("accounting.dailyIncome.statement.placeholders.searchBranches")}
            contentClassName="z-[90]"
            mobileSheet
          />
          {errors.branchId ? <p className="text-sm text-destructive">{errors.branchId.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-date">{t("accounting.dailyIncome.statement.fields.date")}</Label>
          <DateInput id="statement-date" {...register("date")} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="relative z-10 space-y-2">
          <Label htmlFor="statement-currency">{t("accounting.dailyIncome.statement.fields.currency")}</Label>
          <SearchableSelect
            id="statement-currency"
            value={currency ?? ""}
            onValueChange={(next) => {
              setValue("currency", next, { shouldValidate: true });
              if (next.trim().toUpperCase() !== "DOP") {
                setValue("rate", 1, { shouldValidate: true });
              }
            }}
            options={currencyOptions}
            placeholder={t("accounting.dailyIncome.currency.select")}
            mobileSheet
          />
        </div>
        {showExchangeRate ? (
          <div className="space-y-2">
            <Label htmlFor="statement-rate">{t("accounting.dailyIncome.statement.fields.exchangeRate")}</Label>
            <Input id="statement-rate" type="number" step="0.01" {...register("rate", { valueAsNumber: true })} />
            {errors.rate ? <p className="text-sm text-destructive">{errors.rate.message}</p> : null}
          </div>
        ) : (
          <input type="hidden" {...register("rate", { valueAsNumber: true })} />
        )}
      </div>
      <input type="hidden" {...register("branchId", { valueAsNumber: true })} />
      <input type="hidden" {...register("branchCode")} />
      <input type="hidden" {...register("branchName")} />
      {error ? <p className="break-words text-sm text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2 border-t pt-4 sm:flex sm:justify-end">
        <Button type="button" variant="outline" className="min-w-0" onClick={onCancel} disabled={isSubmitting}>
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" className="min-w-0 whitespace-normal" disabled={isSubmitting}>
          {isSubmitting ? t("common.actions.saving") : t("accounting.dailyIncome.statement.save")}
        </Button>
      </div>
    </form>
  );
}
