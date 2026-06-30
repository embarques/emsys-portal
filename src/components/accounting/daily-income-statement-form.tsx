"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { dailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import type { DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import type { Branch } from "@/lib/branches/types";

const currencyOptions = [
  { value: "USD", label: "Dollar" },
  { value: "DOP", label: "Peso" },
];

type Props = {
  branches: Branch[];
  initialValues: DailyIncomeStatementValues;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: DailyIncomeStatementValues) => void;
  onCancel: () => void;
};

export function DailyIncomeStatementForm({ branches, initialValues, isSubmitting, error, onSubmit, onCancel }: Props) {
  const { formState: { errors }, handleSubmit, register, reset, setValue, watch } = useForm<DailyIncomeStatementValues>({
    resolver: zodResolver(dailyIncomeStatementSchema),
    defaultValues: initialValues,
  });

  useEffect(() => reset(initialValues), [initialValues, reset]);
  const branchId = watch("branchId");
  const currency = watch("currency");
  const branchOptions = branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} — ${branch.name}`, keywords: [branch.code, branch.name] }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="statement-branch">Branch</Label>
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
            placeholder="Select branch"
            searchPlaceholder="Search branches…"
          />
          {errors.branchId ? <p className="text-sm text-destructive">{errors.branchId.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-date">Date</Label>
          <DateInput id="statement-date" {...register("date")} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-currency">Currency</Label>
          <SearchableSelect
            id="statement-currency"
            value={currency ?? ""}
            onValueChange={(next) => setValue("currency", next, { shouldValidate: true })}
            options={currencyOptions}
            placeholder="Select currency"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-rate">Exchange rate</Label>
          <Input id="statement-rate" type="number" step="0.01" {...register("rate", { valueAsNumber: true })} />
          {errors.rate ? <p className="text-sm text-destructive">{errors.rate.message}</p> : null}
        </div>
      </div>
      <input type="hidden" {...register("branchId", { valueAsNumber: true })} />
      <input type="hidden" {...register("branchCode")} />
      <input type="hidden" {...register("branchName")} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save daily income"}</Button>
      </div>
    </form>
  );
}
