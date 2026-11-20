"use client";

import { ClipboardList, MessageSquareWarning, UserRound } from "lucide-react";
import { Controller, useWatch } from "react-hook-form";

import {
  ComplaintFieldError,
  ComplaintRequiredMark,
  ComplaintTargetsSection,
} from "@/components/complaints/complaint-targets-section";
import {
  CompactActionDialogContent,
  CompactActionDialogHeader,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SwitchField } from "@/components/ui/switch-field";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import {
  complaintCategoryLabel,
  complaintDetailFieldLabel,
  complaintDetailOptionLabel,
  complaintSeverityLabel,
} from "@/lib/complaints/display";
import type { useComplaintIntake } from "@/lib/complaints/hooks/use-complaint-intake";
import {
  COMPLAINT_SEVERITIES,
  type ComplaintCategory,
  type ComplaintDetailProperty,
} from "@/lib/complaints/types";
import { useTranslation } from "@/lib/i18n";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

type IntakeState = ReturnType<typeof useComplaintIntake>;

/** Select value for "let the API apply the category's default severity" (omitted from the request). */
const CATEGORY_DEFAULT_SEVERITY = "category-default";

function DetailField({
  state,
  fieldKey,
  property,
  required,
}: {
  state: IntakeState;
  fieldKey: string;
  property: ComplaintDetailProperty;
  required: boolean;
}) {
  const { t } = useTranslation();
  const id = `complaint-detail-${fieldKey}`;
  const name = `details.${fieldKey}` as const;
  const label = complaintDetailFieldLabel(t, fieldKey);
  const error = state.form.formState.errors.details?.[fieldKey]?.message;

  if (property.type === "boolean") {
    return (
      <Controller
        control={state.form.control}
        name={name}
        render={({ field }) => (
          <SwitchField
            id={id}
            label={label}
            checked={field.value === true}
            disabled={state.busy}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
        )}
      />
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required ? <ComplaintRequiredMark /> : null}
      </Label>
      {property.enum?.length ? (
        <Controller
          control={state.form.control}
          name={name}
          render={({ field }) => (
            <SearchableSelect
              id={id}
              options={property.enum!.map((value) => ({ value, label: complaintDetailOptionLabel(t, value) }))}
              value={typeof field.value === "string" ? field.value : ""}
              onValueChange={field.onChange}
              disabled={state.busy}
              aria-invalid={Boolean(error)}
              placeholder={t("complaints.form.selectOption")}
              searchPlaceholder={t("complaints.form.searchOptions")}
              emptyMessage={t("complaints.form.noOptions")}
            />
          )}
        />
      ) : property.type === "string" && property.format === "date" ? (
        <DateInput id={id} disabled={state.busy} aria-invalid={Boolean(error)} {...state.form.register(name)} />
      ) : (
        <Input
          id={id}
          type={property.type === "number" || property.type === "integer" ? "number" : "text"}
          inputMode={property.type === "integer" ? "numeric" : property.type === "number" ? "decimal" : undefined}
          min={property.type === "number" || property.type === "integer" ? 0 : undefined}
          step={property.type === "integer" ? 1 : property.type === "number" ? "any" : undefined}
          disabled={state.busy}
          aria-invalid={Boolean(error)}
          {...state.form.register(name)}
        />
      )}
      {property.type === "array" ? (
        <p className="text-xs text-muted-foreground">{t("complaints.form.listHint")}</p>
      ) : null}
      <ComplaintFieldError message={error} />
    </div>
  );
}

function DetailsSection({ state, category }: { state: IntakeState; category: ComplaintCategory }) {
  const { t } = useTranslation();
  const entries = Object.entries(category.detailsSchema.properties).sort(([left], [right]) => {
    const required = category.detailsSchema.required;
    return Number(required.includes(right)) - Number(required.includes(left));
  });
  if (!entries.length) return null;

  return (
    <FormSection
      variant="card"
      icon={ClipboardList}
      title={t("complaints.form.sections.details", { category: complaintCategoryLabel(t, category.key, [category]) })}
      description={t("complaints.form.detailsHint")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map(([key, property]) => (
          <DetailField
            key={`${category.key}:${key}`}
            state={state}
            fieldKey={key}
            property={property}
            required={category.detailsSchema.required.includes(key)}
          />
        ))}
      </div>
    </FormSection>
  );
}

export function ComplaintIntakeDialog({
  state,
  categories,
  categoriesLoading,
  canPickEmployees,
}: {
  state: IntakeState;
  categories: readonly ComplaintCategory[];
  categoriesLoading: boolean;
  canPickEmployees: boolean;
}) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation({ advanceTextareas: false });
  const { errors } = state.form.formState;
  const categoryKey = useWatch({ control: state.form.control, name: "category" });
  const category = state.selectedCategory(categoryKey);
  const categoryOptions = categories.map((item) => ({
    value: item.key,
    label: complaintCategoryLabel(t, item.key, categories),
    keywords: [item.key, item.label],
  }));
  const severityOptions = [
    {
      value: CATEGORY_DEFAULT_SEVERITY,
      label: category
        ? t("complaints.form.severityDefault", { severity: complaintSeverityLabel(t, category.defaultSeverity) })
        : t("complaints.form.severityDefaultGeneric"),
    },
    ...COMPLAINT_SEVERITIES.map((value) => ({ value, label: complaintSeverityLabel(t, value) })),
  ];

  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-3xl")}>
        <CompactActionDialogHeader
          icon={MessageSquareWarning}
          title={t("complaints.add")}
          description={t("complaints.form.description")}
        />
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
          <FormBody workflow isBusy={state.busy}>
            <FormSection variant="card" icon={UserRound} title={t("complaints.form.sections.caller")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="complaint-caller-name">
                    {t("complaints.fields.callerName")}
                    <ComplaintRequiredMark />
                  </Label>
                  <Input
                    id="complaint-caller-name"
                    autoFocus
                    autoComplete="off"
                    disabled={state.busy}
                    aria-invalid={Boolean(errors.callerName)}
                    {...state.form.register("callerName")}
                  />
                  <ComplaintFieldError message={errors.callerName?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="complaint-caller-phone">
                    {t("complaints.fields.callerPhone")}
                    <ComplaintRequiredMark />
                  </Label>
                  <Controller
                    control={state.form.control}
                    name="callerPhone"
                    render={({ field }) => (
                      <PhoneInput
                        id="complaint-caller-phone"
                        autoComplete="off"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={state.busy}
                        aria-invalid={Boolean(errors.callerPhone)}
                      />
                    )}
                  />
                  <ComplaintFieldError message={errors.callerPhone?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="complaint-caller-email">{t("complaints.fields.callerEmail")}</Label>
                  <Input
                    id="complaint-caller-email"
                    type="email"
                    autoComplete="off"
                    disabled={state.busy}
                    aria-invalid={Boolean(errors.callerEmail)}
                    {...state.form.register("callerEmail")}
                  />
                  <ComplaintFieldError message={errors.callerEmail?.message} />
                </div>
              </div>
            </FormSection>

            <FormSection variant="card" icon={MessageSquareWarning} title={t("complaints.form.sections.complaint")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="complaint-category">
                    {t("complaints.fields.category")}
                    <ComplaintRequiredMark />
                  </Label>
                  <SearchableSelect
                    id="complaint-category"
                    options={categoryOptions}
                    value={categoryKey}
                    onValueChange={state.changeCategory}
                    loading={categoriesLoading}
                    disabled={state.busy}
                    aria-invalid={Boolean(errors.category)}
                    placeholder={t("complaints.form.categoryPlaceholder")}
                    searchPlaceholder={t("complaints.form.categorySearch")}
                    emptyMessage={t("complaints.form.categoryEmpty")}
                  />
                  <ComplaintFieldError message={errors.category?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="complaint-severity">{t("complaints.fields.severity")}</Label>
                  <Controller
                    control={state.form.control}
                    name="severity"
                    render={({ field }) => (
                      <SearchableSelect
                        id="complaint-severity"
                        options={severityOptions}
                        value={field.value || CATEGORY_DEFAULT_SEVERITY}
                        onValueChange={(next) => field.onChange(next === CATEGORY_DEFAULT_SEVERITY ? "" : next)}
                        disabled={state.busy}
                        searchPlaceholder={t("complaints.form.searchOptions")}
                        emptyMessage={t("complaints.form.noOptions")}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">{t("complaints.form.severityHint")}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="complaint-subject">
                    {t("complaints.fields.subject")}
                    <ComplaintRequiredMark />
                  </Label>
                  <Input
                    id="complaint-subject"
                    maxLength={120}
                    disabled={state.busy}
                    aria-invalid={Boolean(errors.subject)}
                    {...state.form.register("subject")}
                  />
                  <ComplaintFieldError message={errors.subject?.message} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="complaint-description">
                    {t("complaints.fields.description")}
                    <ComplaintRequiredMark />
                  </Label>
                  <textarea
                    id="complaint-description"
                    rows={4}
                    maxLength={5000}
                    disabled={state.busy}
                    className={textareaClassName}
                    aria-invalid={Boolean(errors.description)}
                    {...state.form.register("description")}
                  />
                  <ComplaintFieldError message={errors.description?.message} />
                </div>
              </div>
            </FormSection>

            {category ? <DetailsSection state={state} category={category} /> : null}

            <ComplaintTargetsSection form={state.form} busy={state.busy} canPickEmployees={canPickEmployees} />
          </FormBody>
          <FormFooter
            error={state.error}
            isSubmitting={state.busy}
            submitLabel={t("complaints.form.submit")}
            onCancel={() => state.setOpen(false)}
          />
        </form>
      </CompactActionDialogContent>
    </Dialog>
  );
}
