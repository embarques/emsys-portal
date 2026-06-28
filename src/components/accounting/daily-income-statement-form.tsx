"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dailyIncomeStatementSchema } from "@/lib/accounting/daily-income/schemas";
import type { DailyIncomeStatementValues } from "@/lib/accounting/daily-income/types";
import type { Branch } from "@/lib/branches/types";

const selectClassName = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="statement-branch">Branch</Label>
          <select
            id="statement-branch"
            className={selectClassName}
            value={branchId || ""}
            onChange={(event) => {
              const branch = branches.find((item) => item.id === Number(event.target.value));
              setValue("branchId", branch?.id ?? 0, { shouldValidate: true });
              setValue("branchCode", branch?.code ?? "", { shouldValidate: true });
              setValue("branchName", branch?.name ?? "", { shouldValidate: true });
            }}
          >
            <option value="">Select branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
          </select>
          {errors.branchId ? <p className="text-sm text-destructive">{errors.branchId.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-date">Date</Label>
          <DateInput id="statement-date" {...register("date")} />
          {errors.date ? <p className="text-sm text-destructive">{errors.date.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="statement-currency">Currency</Label>
          <select id="statement-currency" className={selectClassName} {...register("currency")}>
            <option value="USD">Dollar</option>
            <option value="DOP">Peso</option>
          </select>
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
