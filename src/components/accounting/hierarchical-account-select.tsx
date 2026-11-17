"use client";

import { useMemo } from "react";

import { FieldLabelRow } from "@/components/forms/field-label-row";
import { FieldMessage } from "@/components/forms/field-message";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, SearchableSelect } from "@/components/ui/searchable-select";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import {
  accountPathLabel,
  buildAccountHierarchyLevels,
  listPostingChildren,
} from "@/lib/accounting/daily-income/payment-accounts";
import type { ChartAccount } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  inlineOptionsLimit?: number;
  id: string;
  /** Full posting pool used to resolve children and path labels. */
  accounts: readonly ChartAccount[];
  /** Top-level choices for the first select. */
  roots: readonly ChartAccount[];
  value?: number;
  valueName?: string;
  excludeIds?: readonly number[];
  label: string;
  required?: boolean;
  error?: string;
  hint?: string | null;
  className?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  onChange: (account: ChartAccount | undefined) => void;
};

/**
 * Cascading account picker: any posting level is a valid selection.
 * When the current account has posting children, an optional next select appears
 * so the user can keep refining (Cash → Petty cash → Petty tape, etc.).
 */
export function HierarchicalAccountSelect({
  id,
  accounts,
  roots,
  value,
  valueName,
  excludeIds = [],
  label,
  required = false,
  error,
  hint,
  className,
  placeholder,
  searchPlaceholder,
  onChange,
  inlineOptionsLimit,
}: Props) {
  const { t } = useTranslation();
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const pool = useMemo(
    () => accounts.filter((account) => !account.nonPosting && !excluded.has(account.id)),
    [accounts, excluded],
  );
  const rootOptions = useMemo(
    () => roots.filter((account) => !account.nonPosting && !excluded.has(account.id)),
    [excluded, roots],
  );
  const byId = useMemo(() => new Map(pool.map((account) => [account.id, account])), [pool]);
  const levels = useMemo(
    () => buildAccountHierarchyLevels(pool, rootOptions, value),
    [pool, rootOptions, value],
  );
  const pathSource = useMemo(() => [...pool, ...rootOptions], [pool, rootOptions]);
  const pathById = useMemo(() => new Map(pathSource.map((account) => [account.id, account])), [pathSource]);

  const selectPlaceholder = placeholder ?? t("accounting.dailyIncome.form.placeholders.selectAccount");
  const searchText = searchPlaceholder ?? t("accounting.dailyIncome.form.placeholders.searchAccounts");
  const legendId = `${id}-legend`;

  const rootSelectOptions = useMemo(() => {
    const level = levels[0];
    if (!level) return [];
    return withPinnedSelectOption(
      level.options.map((account) => {
        const path = accountPathLabel(account, pathById);
        const childCount = listPostingChildren(pool, account.id).length;
        return {
          value: String(account.id),
          label: path,
          description:
            childCount > 0
              ? t("accounting.dailyIncome.form.hints.accountHasSubcategories", { count: childCount })
              : undefined,
          keywords: [account.displayName, account.name, path].filter(Boolean) as string[],
        };
      }),
      level.valueId,
      valueName,
    );
  }, [levels, pathById, pool, t, valueName]);

  const rootInline =
    getInlineSelectOptions({
      inlineOptionsLimit,
      options: rootSelectOptions,
      value: levels[0]?.valueId != null ? String(levels[0].valueId) : "",
      placeholder: selectPlaceholder,
    }) !== null;
  const showClear = value != null && rootInline;

  function clearSelection() {
    onChange(undefined);
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  }

  return (
    <fieldset aria-labelledby={legendId} className={className ?? "min-w-0 space-y-2"}>
      <FieldLabelRow showClear={showClear} onClear={clearSelection}>
        <span id={legendId} className="text-sm font-medium leading-5">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </span>
      </FieldLabelRow>
      <div className="space-y-3">
        {levels.map((level, index) => {
          const parent = level.parentId != null ? byId.get(level.parentId) : undefined;
          const levelId = index === 0 ? id : `${id}-level-${index}`;
          const levelLabel =
            index === 0
              ? label
              : t("accounting.dailyIncome.form.fields.accountSubcategory", {
                  parent: parent?.displayName || parent?.name || "",
                });
          const keepParentOption =
            index > 0 && parent
              ? [
                  {
                    value: "",
                    label: t("accounting.dailyIncome.form.placeholders.keepAccountLevel", {
                      name: parent.displayName || parent.name,
                    }),
                    keywords: [parent.displayName, parent.name].filter(Boolean) as string[],
                  },
                ]
              : [];
          const options =
            index === 0
              ? rootSelectOptions
              : withPinnedSelectOption(
                  [
                    ...keepParentOption,
                    ...level.options.map((account) => {
                      const path = accountPathLabel(account, pathById);
                      const childCount = listPostingChildren(pool, account.id).length;
                      return {
                        value: String(account.id),
                        label: account.displayName || account.name,
                        description:
                          childCount > 0
                            ? t("accounting.dailyIncome.form.hints.accountHasSubcategories", {
                                count: childCount,
                              })
                            : undefined,
                        keywords: [account.displayName, account.name, path].filter(Boolean) as string[],
                      };
                    }),
                  ],
                  level.valueId,
                  index === levels.length - 1 ? valueName : undefined,
                );

          return (
            <div key={levelId} className="min-w-0 space-y-2">
              {index > 0 ? (
                <Label htmlFor={levelId} className="text-xs font-medium text-muted-foreground">
                  {levelLabel}
                </Label>
              ) : (
                <span className="sr-only">
                  <Label htmlFor={levelId}>{label}</Label>
                </span>
              )}
              <SearchableSelect
                inlineOptionsLimit={inlineOptionsLimit}
                clearable={false}
                required={required && index === 0}
                id={levelId}
                value={level.valueId != null ? String(level.valueId) : ""}
                onValueChange={(next) => {
                  if (!next) {
                    onChange(index > 0 ? parent : undefined);
                    return;
                  }
                  onChange(byId.get(Number(next)) ?? rootOptions.find((account) => account.id === Number(next)));
                }}
                placeholder={
                  index === 0
                    ? selectPlaceholder
                    : t("accounting.dailyIncome.form.placeholders.selectAccountSubcategory")
                }
                searchPlaceholder={searchText}
                mobileSheet
                options={options}
                aria-invalid={Boolean(error) && index === 0}
              />
            </div>
          );
        })}
      </div>
      <FieldMessage error={error} hint={hint} />
    </fieldset>
  );
}
