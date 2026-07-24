import type { FocusEvent } from "react";

import { cn } from "@/lib/utils";

/** Underline-style inputs used in the invoice wizard (checkout layout). */
export const wizardInputClassName =
  "h-10 rounded-none border-0 border-b-2 border-input bg-transparent px-0 text-sm font-normal shadow-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-muted-foreground/50 sm:h-11 sm:text-base";

export const wizardSelectClassName =
  "min-h-10 rounded-none border-0 border-b-2 border-input bg-transparent py-1.5 pl-0 pr-9 text-sm font-normal shadow-none focus-within:border-muted-foreground/50 data-[state=open]:border-muted-foreground/50 sm:min-h-11 sm:py-2 sm:text-base [&>span:first-child]:font-normal";

export const wizardDateInputClassName = cn(
  wizardInputClassName,
  "pl-8 [&+button]:hidden",
);

export const wizardInputFilledFocusClassName =
  "border-primary/35 focus-visible:border-primary focus-visible:bg-primary/5";

export const wizardSelectFilledFocusClassName =
  "border-primary/35 focus-within:border-primary focus-within:bg-primary/5 data-[state=open]:border-primary data-[state=open]:bg-primary/5";

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
    selectAllOnFocus: hasWizardFieldValue(value),
  };
}

export function wizardLabelClassName(required?: boolean) {
  return cn("text-xs font-normal text-muted-foreground", required && "[&_.req]:text-destructive");
}
