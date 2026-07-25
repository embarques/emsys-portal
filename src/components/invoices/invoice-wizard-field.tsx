"use client";

import { Label } from "@/components/ui/label";
import { wizardLabelClassName } from "@/components/invoices/invoice-wizard-styles";
import { cn } from "@/lib/utils";

type WizardFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function WizardField({ label, htmlFor, required, className, children }: WizardFieldProps) {
  return (
    <div className={cn("space-y-2 md:space-y-2", className)}>
      <Label htmlFor={htmlFor} className={wizardLabelClassName(required)}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
