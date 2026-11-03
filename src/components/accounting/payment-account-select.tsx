"use client";

import { useMemo } from "react";

import { FieldMessage } from "@/components/forms/field-message";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { buildPaymentAccountOptions } from "@/lib/accounting/daily-income/payment-accounts";
import type { ChartAccount } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  id: string;
  kind: "bank" | "cash";
  /** Accounts offered in the picker. */
  accounts: readonly ChartAccount[];
  /** Accounts used to build "Parent › Child" labels (defaults to `accounts`). */
  pathSource?: readonly ChartAccount[];
  value?: number;
  valueName?: string;
  /** Overrides the default Bank account / Cash account label. */
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string | null;
  className?: string;
  onChange: (account: ChartAccount | undefined) => void;
};

export function PaymentAccountSelect({ id, kind, accounts, pathSource, value, valueName, label, required = false, error, hint, className, onChange }: Props) {
  const { t } = useTranslation();
  const fields = "accounting.dailyIncome.form.fields";
  const placeholders = "accounting.dailyIncome.form.placeholders";
  const selectPlaceholder = t(`${placeholders}.${kind === "bank" ? "selectBankAccount" : "selectCashAccount"}`);
  const options = useMemo(
    () =>
      withPinnedSelectOption(
        [
          ...(kind === "bank" ? [{ value: "", label: selectPlaceholder, keywords: [] as string[] }] : []),
          ...buildPaymentAccountOptions(accounts, pathSource ?? accounts),
        ],
        value,
        valueName,
      ),
    [accounts, kind, pathSource, selectPlaceholder, value, valueName],
  );
  const text = label ?? t(`${fields}.${kind === "bank" ? "bankAccount" : "cashAccount"}`);

  return (
    <div className={className ?? "space-y-2 min-w-0"}>
      <Label htmlFor={id}>
        {text}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <SearchableSelect
        id={id}
        value={value != null ? String(value) : ""}
        onValueChange={(next) => onChange(next ? accounts.find((account) => account.id === Number(next)) : undefined)}
        placeholder={selectPlaceholder}
        searchPlaceholder={t(`${placeholders}.${kind === "bank" ? "searchBankAccounts" : "searchCashAccounts"}`)}
        mobileSheet
        options={options}
        aria-invalid={Boolean(error)}
      />
      <FieldMessage error={error} hint={hint} />
    </div>
  );
}
