"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createChartAccountSchema } from "@/lib/accounting/chart-accounts/schemas/chart-account.schema";
import type {
  ChartAccount,
  ChartAccountType,
  ChartAccountValues,
} from "@/lib/accounting/chart-accounts/types";
import type { Branch } from "@/lib/branches/types";
import { useTranslation } from "@/lib/i18n";

const textareaClassName =
  "flex w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

const ACCOUNT_TYPES: ChartAccountType[] = [
  "ASSET",
  "EXPENSE",
  "REVENUE",
  "BANK",
  "LOAN",
];

type Props = {
  initialValues: ChartAccountValues;
  branches: Branch[];
  accounts: ChartAccount[];
  isEditing: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: ChartAccountValues) => void;
  onCancel: () => void;
};

export function ChartAccountForm({
  initialValues,
  branches,
  accounts,
  isEditing,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const schema = useMemo(() => createChartAccountSchema(t), [t]);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ChartAccountValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => reset(initialValues), [initialValues, reset]);

  const accountTypeOptions = useMemo(
    () =>
      ACCOUNT_TYPES.map((type) => ({
        value: type,
        label: t(`accounting.chartOfAccounts.types.${type}`),
      })),
    [t],
  );

  const branchOptions = useMemo(
    () => [
      {
        value: "",
        label: t("accounting.chartOfAccounts.form.options.allBranches"),
      },
      ...branches.map((branch) => ({
        value: String(branch.id),
        label: `${branch.code} — ${branch.name}`,
        keywords: [branch.code, branch.name],
      })),
    ],
    [branches, t],
  );

  const accountOptions = useMemo(
    () => [
      {
        value: "",
        label: t("accounting.chartOfAccounts.form.options.notSubAccount"),
      },
      ...accounts.map((account) => ({
        value: String(account.id),
        label: account.displayName,
      })),
    ],
    [accounts, t],
  );

  const type = watch("type");
  const branchId = watch("branchId");
  const parentAccountId = watch("parentAccountId");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-full min-w-0 space-y-5">
      <div className="min-w-0 space-y-2">
        <Label htmlFor="account-name">
          {t("accounting.chartOfAccounts.form.fields.displayName")}
        </Label>
        <Input
          id="account-name"
          autoFocus
          className="h-12 max-w-full min-w-0 text-base sm:h-9 sm:text-sm"
          {...register("displayName")}
        />
        {errors.displayName ? (
          <p className="text-sm text-destructive">
            {errors.displayName.message}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="account-type">
          {t("accounting.chartOfAccounts.form.fields.type")}
        </Label>
        <SearchableSelect
          id="account-type"
          value={type ?? ""}
          onValueChange={(next) =>
            setValue("type", next as ChartAccountType, { shouldValidate: true })
          }
          options={accountTypeOptions}
          placeholder={t("accounting.chartOfAccounts.form.placeholders.type")}
          className="min-h-12 max-w-full min-w-0 text-base sm:min-h-10 sm:text-sm"
          mobileSheet
        />
        {isEditing ? (
          <p className="text-xs text-muted-foreground">
            {t("accounting.chartOfAccounts.form.hints.typeChange")}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="account-branch">
          {t("accounting.chartOfAccounts.form.fields.branch")}
        </Label>
        <SearchableSelect
          id="account-branch"
          value={branchId != null ? String(branchId) : ""}
          onValueChange={(next) => {
            const branch = branches.find((item) => item.id === Number(next));
            setValue("branchId", branch?.id);
            setValue("branchCode", branch?.code ?? "");
          }}
          options={branchOptions}
          placeholder={t("accounting.chartOfAccounts.form.placeholders.branch")}
          searchPlaceholder={t(
            "accounting.chartOfAccounts.form.placeholders.branchSearch",
          )}
          className="min-h-12 max-w-full min-w-0 text-base sm:min-h-10 sm:text-sm"
          mobileSheet
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="parent-account">
          {t("accounting.chartOfAccounts.form.fields.parent")}
        </Label>
        <SearchableSelect
          id="parent-account"
          value={parentAccountId != null ? String(parentAccountId) : ""}
          onValueChange={(next) => {
            const account = accounts.find((item) => item.id === Number(next));
            setValue("parentAccountId", account?.id);
            setValue("parentAccountName", account?.displayName ?? "");
          }}
          options={accountOptions}
          placeholder={t("accounting.chartOfAccounts.form.placeholders.parent")}
          searchPlaceholder={t(
            "accounting.chartOfAccounts.form.placeholders.parentSearch",
          )}
          className="min-h-12 max-w-full min-w-0 text-base sm:min-h-10 sm:text-sm"
          mobileSheet
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="account-description">
          {t("accounting.chartOfAccounts.form.fields.description")}
        </Label>
        <textarea
          id="account-description"
          rows={4}
          className={`${textareaClassName} h-auto min-w-0 text-base sm:text-sm`}
          {...register("description")}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-2 border-t pt-4 sm:flex sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-10"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t("common.actions.cancel")}
        </Button>
        <Button type="submit" className="h-11 sm:h-10" disabled={isSubmitting}>
          {isSubmitting
            ? t("common.actions.saving")
            : isEditing
              ? t("common.actions.saveChanges")
              : t("accounting.chartOfAccounts.form.createSubmit")}
        </Button>
      </div>
    </form>
  );
}
