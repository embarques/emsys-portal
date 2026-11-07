"use client";

import { useEffect, useRef } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldMessage } from "@/components/forms/field-message";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch-field";
import { submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import {
  resolveDailyIncomeRefNumberMode,
  type DailyIncomeRefNumberMode,
} from "@/lib/accounting/daily-income/ref-number";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  mode?: DailyIncomeRefNumberMode;
  refNumberRegister: UseFormRegisterReturn;
  error?: string;
  disabled?: boolean;
  /** Overrides the hint shown while the reference is system generated. */
  systemHint?: string;
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
  systemHint,
  onModeChange,
}: Props) {
  const { t } = useTranslation();
  const resolvedMode = resolveDailyIncomeRefNumberMode({ refNumberMode: mode });
  const { ref: registerRef, ...refNumberInputProps } = refNumberRegister;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusInputOnCustomRef = useRef(false);

  useEffect(() => {
    if (resolvedMode !== "custom" || !focusInputOnCustomRef.current) return;
    focusInputOnCustomRef.current = false;
    inputRef.current?.focus();
  }, [resolvedMode]);

  function changeMode(next: DailyIncomeRefNumberMode) {
    focusInputOnCustomRef.current = next === "custom";
    onModeChange(next);
  }

  return (
    <div className={cn("grid gap-4 sm:col-span-2", resolvedMode === "custom" && "sm:grid-cols-2")}>
      <SwitchField
        id={`${id}-mode`}
        label={<>{t("accounting.dailyIncome.form.fields.referenceNumber")}: {t(resolvedMode === "system" ? "accounting.dailyIncome.form.fields.referenceNumberModeSystem" : "accounting.dailyIncome.form.fields.referenceNumberModeCustom")}</>}
        description={resolvedMode === "system" ? systemHint ?? t("accounting.dailyIncome.form.fields.referenceNumberSystemHint") : undefined}
        checked={resolvedMode === "system"}
        disabled={disabled}
        onCheckedChange={(checked) => changeMode(checked ? "system" : "custom")}
      />

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
            {...refNumberInputProps}
            ref={(element) => {
              registerRef(element);
              inputRef.current = element;
            }}
            onKeyDown={submitFormOnEnterKeyDown}
            aria-invalid={Boolean(error)}
          />
          <FieldMessage error={error} hint={t("accounting.dailyIncome.form.fields.referenceNumberHint")} />
        </div>
      ) : null}
    </div>
  );
}
