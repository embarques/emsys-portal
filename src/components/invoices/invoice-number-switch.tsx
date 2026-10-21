"use client";

import type { InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  const modeOptions = [
    {
      value: "system",
      label: t("invoices.form.autoNumber.modeSystem"),
      disabled: modeLocked && mode !== "system",
    },
    {
      value: "custom",
      label: t("invoices.form.autoNumber.modeCustom"),
      disabled: !canUseManualNumber || (modeLocked && mode !== "custom"),
    },
  ];

  return (
    <div className={cn("grid gap-4", mode === "custom" && "sm:grid-cols-2", className)}>
      <div className="space-y-2">
        <Label htmlFor={`${id}-mode`}>{t("invoices.form.fields.invoiceNumber")}</Label>
        <SearchableSelect
          id={`${id}-mode`}
          value={mode}
          disabled={disabled}
          onValueChange={(next) => {
            if (modeLocked) return;
            onModeChange(next !== "custom");
            if (next !== "custom") {
              onInvoiceNumberChange("");
            }
          }}
          placeholder={t("invoices.form.placeholders.selectInvoiceNumberMode")}
          searchable={false}
          options={modeOptions}
        />
        {mode === "system" ? (
          <p className="text-xs text-muted-foreground">
            {generatedInvoiceNumber
              ? generatedInvoiceNumber
              : t("invoices.form.autoNumber.hint")}
          </p>
        ) : null}
        {!canUseManualNumber ? (
          <p className="text-xs text-muted-foreground">{t("invoices.form.autoNumber.permissionHint")}</p>
        ) : null}
      </div>

      {mode === "custom" ? (
        <div className="space-y-2">
          <RequiredLabel htmlFor={id}>{t("invoices.form.autoNumber.customLabel")}</RequiredLabel>
          <Input
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
