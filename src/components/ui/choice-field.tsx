"use client";

import * as React from "react";

import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChoiceFieldProps<T extends string> = {
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  value: T;
  options: SegmentedControlOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/** A labeled single choice shown as side-by-side buttons, with an optional description. */
export function ChoiceField<T extends string>({ id, label, description, value, options, onValueChange, disabled, className }: ChoiceFieldProps<T>) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const labelId = `${controlId}-label`;
  const descriptionId = `${controlId}-description`;

  return (
    <div className={cn("min-w-0 space-y-2 rounded-xl border border-border bg-muted/20 px-4 py-3", className)}>
      <div className="min-w-0 space-y-1">
        <p id={labelId} className="break-words text-sm font-medium leading-none">{label}</p>
        {description ? <div id={descriptionId} className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      <SegmentedControl
        id={controlId}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        value={value}
        options={options}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </div>
  );
}

type YesNoChoiceFieldProps = Omit<ChoiceFieldProps<"yes" | "no">, "value" | "options" | "onValueChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** Drop-in replacement for a switch: the same on/off setting as "No" / "Yes" buttons. */
export function YesNoChoiceField({ checked, onCheckedChange, ...props }: YesNoChoiceFieldProps) {
  const { t } = useTranslation();
  return (
    <ChoiceField
      {...props}
      value={checked ? "yes" : "no"}
      options={[{ value: "no", label: t("common.ui.no") }, { value: "yes", label: t("common.ui.yes") }]}
      onValueChange={(next) => onCheckedChange?.(next === "yes")}
    />
  );
}
