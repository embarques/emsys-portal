"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { chartAccountSchema } from "@/lib/accounting/chart-accounts/schemas/chart-account.schema";
import type { ChartAccount, ChartAccountValues } from "@/lib/accounting/chart-accounts/types";
import type { Branch } from "@/lib/branches/types";

const textareaClassName = "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";
const accountTypeOptions = [
  { value: "ASSET", label: "Asset" },
  { value: "EXPENSE", label: "Expense" },
  { value: "REVENUE", label: "Revenue" },
  { value: "BANK", label: "Bank" },
  { value: "LOAN", label: "Loan" },
];
type AccountType = ChartAccountValues["type"];
type Props = { initialValues: ChartAccountValues; branches: Branch[]; accounts: ChartAccount[]; isEditing: boolean; isSubmitting: boolean; error?: string | null; onSubmit: (values: ChartAccountValues) => void; onCancel: () => void };

export function ChartAccountForm({ initialValues, branches, accounts, isEditing, isSubmitting, error, onSubmit, onCancel }: Props) {
  const { formState: { errors }, handleSubmit, register, reset, setValue, watch } = useForm<ChartAccountValues>({ resolver: zodResolver(chartAccountSchema), defaultValues: initialValues });
  useEffect(() => reset(initialValues), [initialValues, reset]);
  const branchOptions = [{ value: "", label: "All branches" }, ...branches.map((branch) => ({ value: String(branch.id), label: `${branch.code} — ${branch.name}`, keywords: [branch.code, branch.name] }))];
  const accountOptions = [{ value: "", label: "Not a sub-account" }, ...accounts.map((account) => ({ value: String(account.id), label: account.displayName }))];
  const type = watch("type");
  const branchId = watch("branchId");
  const parentAccountId = watch("parentAccountId");
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="account-name">Account name</Label><Input id="account-name" autoFocus {...register("displayName")} />{errors.displayName ? <p className="text-sm text-destructive">{errors.displayName.message}</p> : null}</div>
    <div className="space-y-2"><Label htmlFor="account-type">Account type</Label><SearchableSelect id="account-type" value={type ?? ""} onValueChange={(next) => setValue("type", next as AccountType, { shouldValidate: true })} options={accountTypeOptions} placeholder="Select account type" />{isEditing ? <p className="text-xs text-muted-foreground">Changing the type can affect how this account is used in reports.</p> : null}</div>
    <div className="space-y-2"><Label htmlFor="account-branch">Branch</Label><SearchableSelect id="account-branch" value={branchId != null ? String(branchId) : ""} onValueChange={(next) => { const branch = branches.find((item) => item.id === Number(next)); setValue("branchId", branch?.id); setValue("branchCode", branch?.code ?? ""); }} options={branchOptions} placeholder="All branches" searchPlaceholder="Search branches…" /></div>
    <div className="space-y-2"><Label htmlFor="parent-account">Parent account</Label><SearchableSelect id="parent-account" value={parentAccountId != null ? String(parentAccountId) : ""} onValueChange={(next) => { const account = accounts.find((item) => item.id === Number(next)); setValue("parentAccountId", account?.id); setValue("parentAccountName", account?.displayName ?? ""); }} options={accountOptions} placeholder="Not a sub-account" searchPlaceholder="Search accounts…" /></div>
    <div className="space-y-2"><Label htmlFor="account-description">Description</Label><textarea id="account-description" rows={4} className={`${textareaClassName} h-auto`} {...register("description")} /></div>
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
    <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Create account"}</Button></div>
  </form>;
}
