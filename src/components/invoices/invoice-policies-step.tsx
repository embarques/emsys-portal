"use client";

import { SignaturePad } from "@/components/invoices/signature-pad";
import { InvoiceWizardReviewSection } from "@/components/invoices/invoice-wizard-review-section";
import { Label } from "@/components/ui/label";
import type { InvoicePolicy } from "@/lib/invoice-policies/types";
import { useTranslation } from "@/lib/i18n";

export type InvoicePoliciesAgreementState = {
  agreed: boolean;
  signatureDataUrl: string | null;
};

type Props = {
  /** Review section number, continuing the review step numbering. */
  number: number;
  variant?: "default" | "phonePanel";
  policies: InvoicePolicy[];
  value: InvoicePoliciesAgreementState;
  onChange: (next: InvoicePoliciesAgreementState) => void;
  disabled?: boolean;
  className?: string;
};

export function InvoicePoliciesStep({
  number,
  variant = "default",
  policies,
  value,
  onChange,
  disabled = false,
  className,
}: Props) {
  const { t } = useTranslation();

  return (
    <InvoiceWizardReviewSection
      number={number}
      title={t("invoices.wizard.policies.title")}
      variant={variant}
      className={className}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("invoices.wizard.policies.description")}
        </p>

        <div
          role="region"
          aria-label={t("invoices.wizard.policies.title")}
          tabIndex={0}
          className="max-h-[min(40dvh,24rem)] overflow-y-auto overscroll-contain rounded-lg border border-border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
        >
          <ol className="space-y-4">
            {policies.map((policy, index) => (
              <li key={policy.id} className="rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-4">
                <p className="text-sm font-semibold text-foreground">
                  {index + 1}. {policy.title}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {policy.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <Label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
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

        <div>
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
    </InvoiceWizardReviewSection>
  );
}
