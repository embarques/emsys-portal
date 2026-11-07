"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  /** Render the mode choice as segments instead of a dropdown. */
  variant?: "select" | "segmented";
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
  variant = "select",
  inputProps,
  onModeChange,
  onInvoiceNumberChange,
}: Props) {
  const { t } = useTranslation();
  const mode: Mode = autoGenerate ? "system" : "custom";
  // Locked modes stay focusable so Enter navigation still stops on this field.
  const modeLocked = !canUseManualNumber || Boolean(generatedInvoiceNumber);
  const modeOptions: { value: Mode; label: string; disabled: boolean }[] = [
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

  const inputRef = useRef<HTMLInputElement>(null);
  const focusInputOnCustomRef = useRef(false);

  useEffect(() => {
    if (mode !== "custom" || !focusInputOnCustomRef.current) return;
    focusInputOnCustomRef.current = false;
    inputRef.current?.focus();
  }, [mode]);

  function changeMode(next: string) {
    if (modeLocked) return;
    focusInputOnCustomRef.current = next === "custom";
    onModeChange(next !== "custom");
    if (next !== "custom") {
      onInvoiceNumberChange("");
    }
  }

  return (
    <div className={cn("grid gap-4", mode === "custom" && "sm:grid-cols-2", className)}>
      <div className="space-y-2">
        {variant === "segmented" ? (
          <>
            <Label id={`${id}-mode-label`}>{t("invoices.form.fields.invoiceNumber")}</Label>
            <SegmentedControl
              id={`${id}-mode`}
              aria-labelledby={`${id}-mode-label`}
              value={mode}
              disabled={disabled}
              onValueChange={changeMode}
              options={modeOptions}
              className="h-9 max-md:h-12 [&>button]:py-0"
            />
          </>
        ) : (
          <>
            <Label htmlFor={`${id}-mode`}>{t("invoices.form.fields.invoiceNumber")}</Label>
            <SearchableSelect
              id={`${id}-mode`}
              value={mode}
              disabled={disabled}
              onValueChange={changeMode}
              placeholder={t("invoices.form.placeholders.selectInvoiceNumberMode")}
              searchable={false}
              options={modeOptions}
            />
          </>
        )}
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
