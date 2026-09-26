"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import {
  resolveDailyIncomeRefNumberMode,
  type DailyIncomeRefNumberMode,
} from "@/lib/accounting/daily-income/ref-number";
import { useTranslation } from "@/lib/i18n";

type Props = {
  id?: string;
  mode?: DailyIncomeRefNumberMode;
  refNumberRegister: UseFormRegisterReturn;
  error?: string;
  disabled?: boolean;
  onModeChange: (mode: DailyIncomeRefNumberMode) => void;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

export function TransactionReferenceNumberFields({
  id = "journal-reference",
  mode,
  refNumberRegister,
  error,
  disabled = false,
  onModeChange,
}: Props) {
  const { t } = useTranslation();
  const resolvedMode = resolveDailyIncomeRefNumberMode({ refNumberMode: mode });
  const modeOptions = [
    {
      value: "system",
      label: t("accounting.dailyIncome.form.fields.referenceNumberModeSystem"),
    },
    {
      value: "custom",
      label: t("accounting.dailyIncome.form.fields.referenceNumberModeCustom"),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
      <div className="space-y-2">
        <Label htmlFor={`${id}-mode`}>{t("accounting.dailyIncome.form.fields.referenceNumber")}</Label>
        <SearchableSelect
          id={`${id}-mode`}
          value={resolvedMode}
          disabled={disabled}
          onValueChange={(next) => onModeChange(next === "custom" ? "custom" : "system")}
          placeholder={t("accounting.dailyIncome.form.placeholders.selectReferenceNumberMode")}
          searchable={false}
          options={modeOptions}
        />
        {resolvedMode === "system" ? (
          <p className="text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.fields.referenceNumberSystemHint")}
          </p>
        ) : null}
      </div>

      {resolvedMode === "custom" ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={id}>
            {t("accounting.dailyIncome.form.fields.referenceNumberCustom")}
          </RequiredLabel>
          <Input
            id={id}
            disabled={disabled}
            autoComplete="off"
            placeholder={t("accounting.dailyIncome.form.placeholders.enterReferenceNumber")}
            {...refNumberRegister}
            onKeyDown={submitFormOnEnterKeyDown}
          />
          <p className="text-xs text-muted-foreground">
            {t("accounting.dailyIncome.form.fields.referenceNumberHint")}
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
