import type { FocusEvent } from "react";

import { cn } from "@/lib/utils";

/** Underline-style inputs used in the invoice wizard (checkout layout). */
export const wizardInputClassName =
  "h-12 rounded-xl border border-input bg-background px-3 text-base font-medium shadow-xs placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:h-11 md:rounded-none md:border-0 md:border-b-2 md:bg-transparent md:px-0 md:font-normal md:shadow-none md:focus-visible:border-muted-foreground/50 md:focus-visible:ring-0";

export const wizardSelectClassName =
  "min-h-12 rounded-xl border border-input bg-background py-2.5 pl-3 pr-10 text-base font-medium shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] data-[state=open]:border-ring data-[state=open]:ring-ring/50 data-[state=open]:ring-[3px] md:min-h-11 md:rounded-none md:border-0 md:border-b-2 md:bg-transparent md:py-2 md:pl-0 md:pr-9 md:font-normal md:shadow-none md:focus-within:border-muted-foreground/50 md:focus-within:ring-0 md:data-[state=open]:border-muted-foreground/50 md:data-[state=open]:ring-0 [&>span:first-child]:font-normal md:[&>span:first-child]:font-normal";

export const wizardDateInputClassName = cn(
  wizardInputClassName,
  "pl-9 md:pl-8 [&+button]:hidden",
);

export const wizardInputFilledFocusClassName =
  "border-primary/45 bg-primary/[0.03] focus-visible:border-primary focus-visible:bg-primary/5 md:border-primary/35";

export const wizardSelectFilledFocusClassName =
  "border-primary/45 bg-primary/[0.03] focus-within:border-primary focus-within:bg-primary/5 data-[state=open]:border-primary data-[state=open]:bg-primary/5 md:border-primary/35";

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
    "text-sm font-medium text-muted-foreground md:text-xs md:font-normal",
    required && "[&_.req]:text-destructive",
  );
}
