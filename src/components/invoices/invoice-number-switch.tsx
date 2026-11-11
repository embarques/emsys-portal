"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  /** Switch: a system-number toggle with the custom input below when off. Segmented: mode segments. */
  variant?: "switch" | "segmented";
  /** Segmented only: no visible labels; the custom input sits directly under the segments, which name it. */
  compact?: boolean;
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
  variant = "switch",
  compact = false,
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

  const customInput = (
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
  );

  if (variant === "segmented") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="space-y-2">
          <Label id={`${id}-mode-label`} className={compact ? "sr-only" : undefined}>{t("invoices.form.fields.invoiceNumber")}</Label>
          <div data-enter-navigation="field">
            <SegmentedControl<Mode>
              id={`${id}-mode`}
              aria-labelledby={`${id}-mode-label`}
              value={mode}
              disabled={disabled}
              onValueChange={changeMode}
              options={[
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
              ]}
            />
          </div>
        </div>
        {mode === "system" ? (
          <p className="text-xs text-muted-foreground">
            {generatedInvoiceNumber || t("invoices.form.autoNumber.hint")}
          </p>
        ) : null}
        {!canUseManualNumber ? (
          <p className="text-xs text-muted-foreground">{t("invoices.form.autoNumber.permissionHint")}</p>
        ) : null}
        {mode === "custom" ? (
          <div className={compact ? undefined : "space-y-2 pt-2"}>
            {compact ? (
              <Label htmlFor={id} className="sr-only">{t("invoices.form.autoNumber.customLabel")}</Label>
            ) : (
              <RequiredLabel htmlFor={id}>{t("invoices.form.autoNumber.customLabel")}</RequiredLabel>
            )}
            {customInput}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {mode === "custom" ? (
        <RequiredLabel htmlFor={id}>{t("invoices.form.fields.invoiceNumber")}</RequiredLabel>
      ) : (
        <Label>{t("invoices.form.fields.invoiceNumber")}</Label>
      )}
      <SwitchField
        id={`${id}-mode`}
        label={t("invoices.form.autoNumber.hint")}
        description={generatedInvoiceNumber || !canUseManualNumber ? <>
          {generatedInvoiceNumber ? <p>{generatedInvoiceNumber}</p> : null}
          {!canUseManualNumber ? <p>{t("invoices.form.autoNumber.permissionHint")}</p> : null}
        </> : undefined}
        checked={autoGenerate}
        disabled={disabled}
        aria-readonly={modeLocked || undefined}
        onCheckedChange={(checked) => changeMode(checked ? "system" : "custom")}
      />
      {mode === "custom" ? customInput : null}
    </div>
  );
}
