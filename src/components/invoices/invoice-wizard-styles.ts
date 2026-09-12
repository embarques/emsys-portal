import type { FocusEvent } from "react";

import { cn } from "@/lib/utils";

/** Underline-style inputs used in the invoice wizard (checkout layout). */
export const wizardInputClassName =
  "h-12 rounded-xl border border-input bg-card px-3 text-base shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:h-9 md:rounded-md md:bg-card md:px-3 md:text-sm";

export const wizardSelectClassName =
  "min-h-12 rounded-xl border border-input bg-card py-2.5 pl-3 pr-10 text-base shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] data-[state=open]:border-ring data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px] md:min-h-9 md:rounded-md md:bg-card md:py-1.5 md:pl-3 md:pr-9 md:text-sm [&>span:first-child]:font-normal";

export const wizardDateInputClassName = cn(
  wizardInputClassName,
  "pl-9 md:pl-8 [&+button]:hidden",
);

export const wizardInputFilledFocusClassName =
  "border-primary/45 bg-primary/[0.03] focus-visible:border-primary focus-visible:bg-primary/5";

export const wizardSelectFilledFocusClassName =
  "border-primary/45 bg-primary/[0.03] focus-within:border-primary focus-within:bg-primary/5 data-[state=open]:border-primary data-[state=open]:bg-primary/5";

export function hasWizardFieldValue(value: string | number | undefined | null): boolean {
  return String(value ?? "").trim() !== "";
}

export function wizardInputClassNameFor(value: string | number | undefined | null) {
  return cn(wizardInputClassName, hasWizardFieldValue(value) && wizardInputFilledFocusClassName);
}

export function wizardSelectClassNameFor(value: string | number | undefined | null) {
  return cn(wizardSelectClassName, hasWizardFieldValue(value) && wizardSelectFilledFocusClassName);
}

/** Select all text on focus so filled wizard fields can be replaced in one keystroke. */
export function selectAllFieldTextOnFocus(value: string | number | undefined | null) {
  return (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!hasWizardFieldValue(value)) return;
    const target = event.currentTarget;
    window.requestAnimationFrame(() => target.select());
  };
}

export function wizardInputFieldProps(
  value: string | number | undefined | null,
  className?: string,
) {
  return {
    className: cn(wizardInputClassNameFor(value), className),
    onFocus: selectAllFieldTextOnFocus(value),
  };
}

export function wizardSelectFieldProps(value: string | number | undefined | null) {
  return {
    className: wizardSelectClassNameFor(value),
    mobileSheet: true,
    selectAllOnFocus: hasWizardFieldValue(value),
  };
}

export function wizardLabelClassName(required?: boolean) {
  return cn(
    "text-sm font-medium text-muted-foreground",
    required && "[&_.req]:text-destructive",
  );
}
