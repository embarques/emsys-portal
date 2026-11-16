"use client";

import { useMemo } from "react";

import { HierarchicalAccountSelect } from "@/components/accounting/hierarchical-account-select";
import {
  listBankHierarchyRoots,
  listCashAccounts,
  listCashHierarchyRoots,
} from "@/lib/accounting/daily-income/payment-accounts";
import type { ChartAccount } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  inlineOptionsLimit?: number;
  id: string;
  kind: "bank" | "cash";
  /** Accounts offered in the picker. */
  accounts: readonly ChartAccount[];
  /** Accounts used to build hierarchy/path labels (defaults to `accounts`). */
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

export function PaymentAccountSelect({
  id,
  kind,
  accounts,
  pathSource,
  value,
  valueName,
  label,
  required = false,
  error,
  hint,
  className,
  onChange,
  inlineOptionsLimit,
}: Props) {
  const { t } = useTranslation();
  const fields = "accounting.dailyIncome.form.fields";
  const placeholders = "accounting.dailyIncome.form.placeholders";
  const pool = pathSource ?? accounts;
  const roots = useMemo(
    () => (kind === "cash" ? listCashHierarchyRoots(pool) : listBankHierarchyRoots(pool)),
    [kind, pool],
  );
  const hierarchyAccounts = useMemo(() => {
    if (kind === "cash") return listCashAccounts(pool);
    return pool.filter((account) => account.type === "BANK");
  }, [kind, pool]);

  return (
    <HierarchicalAccountSelect
      inlineOptionsLimit={inlineOptionsLimit}
      id={id}
      accounts={hierarchyAccounts}
      roots={roots}
      value={value}
      valueName={valueName}
      label={label ?? t(`${fields}.${kind === "bank" ? "bankAccount" : "cashAccount"}`)}
      required={required}
      error={error}
      hint={hint}
      className={className}
      placeholder={t(`${placeholders}.${kind === "bank" ? "selectBankAccount" : "selectCashAccount"}`)}
      searchPlaceholder={t(`${placeholders}.${kind === "bank" ? "searchBankAccounts" : "searchCashAccounts"}`)}
      onChange={onChange}
    />
  );
}
