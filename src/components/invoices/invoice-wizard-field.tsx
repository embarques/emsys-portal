"use client";

import { Label } from "@/components/ui/label";
import { wizardLabelClassName } from "@/components/invoices/invoice-wizard-styles";
import { cn } from "@/lib/utils";

type WizardFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  /** Optional create/edit control aligned with the label (e.g. FieldEntityActions). */
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function WizardField({
  label,
  htmlFor,
  required,
  className,
  action,
  children,
}: WizardFieldProps) {
  return (
    <div className={cn("space-y-2 md:space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className={wizardLabelClassName(required)}>
          {label}
          {required ? <span className="req"> *</span> : null}
        </Label>
        {action}
      </div>
      {children}
    </div>
  );
}
