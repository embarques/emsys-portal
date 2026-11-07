"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchField } from "@/components/ui/switch-field";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Mode = "system" | "custom";

type Props = {
  id?: string;
  autoGenerate: boolean;
  invoiceNumber: string;
  generatedInvoiceNumber?: string;
  canUseManualNumber?: boolean;
  disabled?: boolean;
  className?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "disabled">;
  onModeChange: (autoGenerate: boolean) => void;
  onInvoiceNumberChange: (value: string) => void;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

export function InvoiceNumberModeFields({
  id = "invoiceNumber",
  autoGenerate,
  invoiceNumber,
  generatedInvoiceNumber = "",
  canUseManualNumber = true,
  disabled = false,
  className,
  inputProps,
  onModeChange,
  onInvoiceNumberChange,
}: Props) {
  const { t } = useTranslation();
  const mode: Mode = autoGenerate ? "system" : "custom";
  // Locked modes stay focusable so Enter navigation still stops on this field.
  const modeLocked = !canUseManualNumber || Boolean(generatedInvoiceNumber);

  const inputRef = useRef<HTMLInputElement>(null);
  const focusInputOnCustomRef = useRef(false);

  useEffect(() => {
    if (mode !== "custom" || !focusInputOnCustomRef.current) return;
    focusInputOnCustomRef.current = false;
    inputRef.current?.focus();
  }, [mode]);

  function changeMode(next: Mode) {
    if (modeLocked) return;
    focusInputOnCustomRef.current = next === "custom";
    onModeChange(next !== "custom");
    if (next !== "custom") {
      onInvoiceNumberChange("");
    }
  }

  return (
    <div className={cn("grid gap-4", mode === "custom" && "sm:grid-cols-2", className)}>
      <SwitchField
        id={`${id}-mode`}
        label={<>{t("invoices.form.fields.invoiceNumber")}: {t(autoGenerate ? "invoices.form.autoNumber.modeSystem" : "invoices.form.autoNumber.modeCustom")}</>}
        description={mode === "system" || !canUseManualNumber ? <>
          {mode === "system" ? <p>{generatedInvoiceNumber || t("invoices.form.autoNumber.hint")}</p> : null}
          {!canUseManualNumber ? <p>{t("invoices.form.autoNumber.permissionHint")}</p> : null}
        </> : undefined}
        checked={autoGenerate}
        disabled={disabled}
        aria-readonly={modeLocked || undefined}
        onCheckedChange={(checked) => changeMode(checked ? "system" : "custom")}
      />

      {mode === "custom" ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={id}>{t("invoices.form.autoNumber.customLabel")}</RequiredLabel>
          <Input
            ref={inputRef}
            id={id}
            value={invoiceNumber}
            onChange={(event) => onInvoiceNumberChange(event.target.value)}
            disabled={disabled}
            placeholder={t("invoices.form.placeholders.invoiceNumber")}
            autoComplete="off"
            required
            {...inputProps}
          />
        </div>
      ) : null}
    </div>
  );
}
