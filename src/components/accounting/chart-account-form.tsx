"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chartAccountSchema } from "@/lib/accounting/daily-income/schemas";
import type { ChartAccount, ChartAccountValues } from "@/lib/accounting/daily-income/types";
import type { Branch } from "@/lib/branches/types";

const selectClassName = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";
type Props = { initialValues: ChartAccountValues; branches: Branch[]; accounts: ChartAccount[]; isEditing: boolean; isSubmitting: boolean; error?: string | null; onSubmit: (values: ChartAccountValues) => void; onCancel: () => void };

export function ChartAccountForm({ initialValues, branches, accounts, isEditing, isSubmitting, error, onSubmit, onCancel }: Props) {
  const { formState: { errors }, handleSubmit, register, reset, setValue } = useForm<ChartAccountValues>({ resolver: zodResolver(chartAccountSchema), defaultValues: initialValues });
  useEffect(() => reset(initialValues), [initialValues, reset]);
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="account-name">Account name</Label><Input id="account-name" autoFocus {...register("displayName")} />{errors.displayName ? <p className="text-sm text-destructive">{errors.displayName.message}</p> : null}</div>
    <div className="space-y-2"><Label htmlFor="account-type">Account type</Label><select id="account-type" className={selectClassName} {...register("type")}><option value="ASSET">Asset</option><option value="EXPENSE">Expense</option><option value="REVENUE">Revenue</option><option value="BANK">Bank</option><option value="LOAN">Loan</option></select>{isEditing ? <p className="text-xs text-muted-foreground">Changing the type can affect how this account is used in reports.</p> : null}</div>
    <div className="space-y-2"><Label htmlFor="account-branch">Branch</Label><select id="account-branch" className={selectClassName} defaultValue={initialValues.branchId ?? ""} onChange={(event) => { const branch = branches.find((item) => item.id === Number(event.target.value)); setValue("branchId", branch?.id); setValue("branchCode", branch?.code ?? ""); }}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="parent-account">Parent account</Label><select id="parent-account" className={selectClassName} defaultValue={initialValues.parentAccountId ?? ""} onChange={(event) => { const account = accounts.find((item) => item.id === Number(event.target.value)); setValue("parentAccountId", account?.id); setValue("parentAccountName", account?.displayName ?? ""); }}><option value="">Not a sub-account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="account-description">Description</Label><textarea id="account-description" rows={4} className={`${selectClassName} h-auto py-2`} {...register("description")} /></div>
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
    <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Create account"}</Button></div>
  </form>;
}
