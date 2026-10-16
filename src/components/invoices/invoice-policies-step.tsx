"use client";

import { ScrollText } from "lucide-react";

import { SignaturePad } from "@/components/invoices/signature-pad";
import { Label } from "@/components/ui/label";
import type { InvoicePolicy } from "@/lib/invoice-policies/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type InvoicePoliciesAgreementState = {
  agreed: boolean;
  signatureDataUrl: string | null;
};

type Props = {
  policies: InvoicePolicy[];
  value: InvoicePoliciesAgreementState;
  onChange: (next: InvoicePoliciesAgreementState) => void;
  disabled?: boolean;
  className?: string;
};

export function InvoicePoliciesStep({
  policies,
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-5 px-4 py-4 sm:px-6", className)}>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
            <ScrollText className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              {t("invoices.wizard.policies.title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("invoices.wizard.policies.description")}
            </p>
          </div>
        </div>

        <ol className="space-y-4">
          {policies.map((policy, index) => (
            <li key={policy.id} className="rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4">
              <p className="text-sm font-semibold text-foreground">
                {index + 1}. {policy.title}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {policy.body}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <Label className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <input
          id="invoice-policies-agree"
          type="checkbox"
          className="mt-1 size-4"
          checked={value.agreed}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, agreed: event.target.checked })}
        />
        <span className="text-sm leading-snug text-foreground">
          {t("invoices.wizard.policies.agreeLabel")}
        </span>
      </Label>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Label htmlFor="invoice-signature-pad" className="text-sm font-medium">
          {t("invoices.wizard.policies.signatureLabel")}{" "}
          <span className="text-destructive">*</span>
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("invoices.wizard.policies.signatureHint")}
        </p>
        <div id="invoice-signature-pad" className="mt-3">
          <SignaturePad
            value={value.signatureDataUrl}
            disabled={disabled}
            onChange={(signatureDataUrl) => onChange({ ...value, signatureDataUrl })}
          />
        </div>
      </div>
    </div>
  );
}
