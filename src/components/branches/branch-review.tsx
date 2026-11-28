"use client";

import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import {
  formatBranchAddress,
  formatBranchPhones,
} from "@/lib/branches/display";
import {
  getBranchStepLabelKey,
  type BranchFormStep,
} from "@/lib/branches/branch-workflow";
import type { BranchFormValues } from "@/lib/branches/types";
import { useTranslation } from "@/lib/i18n";

type Props = {
  values: BranchFormValues;
  onEdit?: (step: BranchFormStep) => void;
};

export function BranchReview({ values, onEdit }: Props) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const booleanLabel = (value: boolean) =>
    t(value ? "branches.enums.boolean.true" : "branches.enums.boolean.false");

  const groups: {
    step: Exclude<BranchFormStep, "review">;
    rows: [string, string | number | undefined][];
  }[] = [
    {
      step: "branch",
      rows: [
        ["branches.form.fields.name", values.name.trim() || dash],
        ["branches.form.fields.code", values.code.trim() || dash],
        ["branches.form.fields.type", values.type.trim() || dash],
        ["branches.form.fields.logo", values.logo.trim() || dash],
        ["branches.form.fields.disclaimer", values.disclaimer.trim() || dash],
      ],
    },
    {
      step: "address",
      rows: [["branches.form.fields.address1", formatBranchAddress({ address: values.address })]],
    },
    {
      step: "contact",
      rows: [["branches.form.fields.phones", formatBranchPhones({ phones: values.phones }) || dash]],
    },
    {
      step: "settings",
      rows: [
        ["branches.form.fields.labelPrefix", values.settings.labelPrefix.trim() || dash],
        ["branches.form.fields.roundDecimalPlaces", values.settings.roundDecimalPlaces],
        [
          "branches.form.fields.defaultLabelStatus",
          values.settings.defaultLabelStatus
            ? values.settings.defaultLabelStatus
            : t("branches.form.defaultLabelStatusUnconfigured"),
        ],
        ["branches.form.fields.imageResampleBy", values.settings.imageResampleBy],
        ["branches.form.fields.s3Profile", values.settings.s3Profile.trim() || dash],
        ["branches.form.fields.s3BucketName", values.settings.s3BucketName.trim() || dash],
        ["branches.form.fields.s3BucketFolder", values.settings.s3BucketFolder.trim() || dash],
        ["branches.form.fields.s3ShareLinkExpireMinutes", values.settings.s3ShareLinkExpireMinutes],
        [
          "branches.form.fields.invoiceCreatedThruIncomeStatement",
          booleanLabel(values.settings.invoiceCreatedThruIncomeStatement),
        ],
        ["branches.form.fields.printLabelCount", booleanLabel(values.settings.printLabelCount)],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map(({ step, rows }) => (
        <FormSection
          key={step}
          variant="card"
          title={t(getBranchStepLabelKey(step))}
          action={
            onEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`${t("common.actions.edit")}: ${t(getBranchStepLabelKey(step))}`}
                onClick={() => onEdit(step)}
              >
                {t("common.actions.edit")}
              </Button>
            ) : undefined
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t(label)}</dt>
                <dd className="mt-1 break-words whitespace-pre-wrap text-sm font-medium">
                  {value === undefined || value === "" ? dash : value}
                </dd>
              </div>
            ))}
          </dl>
        </FormSection>
      ))}
    </div>
  );
}
