"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { branchFormSchema } from "@/lib/branches/schemas/branch.schema";
import { ArrowLeft, Building2, MapPin, Phone, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { BranchReview } from "@/components/branches/branch-review";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch-field";
import { Label } from "@/components/ui/label";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { useTranslation } from "@/lib/i18n";
import { useIsGoogleMapsConfigured } from "@/lib/company/hooks/use-current-company";
import {
  getBranchStepFields,
  getBranchStepHintKey,
  getBranchStepLabelKey,
  type BranchFormStep,
} from "@/lib/branches/branch-workflow";
import {
  type BranchAddress,
  type BranchFormValues,
  type BranchSettings,
  createEmptyBranchForm,
} from "@/lib/branches/types";
import type { ParsedPlaceAddress } from "@/lib/customers/types";
import { cn } from "@/lib/utils";

type BranchFormProps = {
  formId?: string;
  initialValues?: BranchFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  /** When set, the form runs as a guided wizard (one step visible). */
  activeStep?: BranchFormStep;
  onContinue?: () => void;
  onStepChange?: (step: BranchFormStep) => void;
  onStepBack?: () => void;
  stepBackDisabled?: boolean;
  onStepErrorChange?: (error: string | null) => void;
  /** Hide the built-in footer when the host renders GuidedEntryFooter. */
  hideFooter?: boolean;
  onSubmit: (values: BranchFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function BranchForm({
  formId,
  initialValues,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  activeStep,
  onContinue,
  onStepChange,
  onStepBack,
  stepBackDisabled = false,
  onStepErrorChange,
  hideFooter = false,
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const { t } = useTranslation();
  const googleMapsConfigured = useIsGoogleMapsConfigured();
  const {
    control,
    reset,
    setValue,
    getValues,
    handleSubmit,
    trigger,
    getFieldState,
    formState: { errors },
  } = useForm<BranchFormValues>({
    defaultValues: initialValues ?? createEmptyBranchForm(),
    resolver: zodResolver(branchFormSchema),
    shouldFocusError: !activeStep,
  });
  const values = useWatch({ control }) as BranchFormValues;
  const [manualAddressEntry, setManualAddressEntry] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const advancingStepRef = useRef<BranchFormStep | null>(null);
  const savingRef = useRef(false);
  const guided = Boolean(activeStep);

  useEffect(() => {
    reset(initialValues ?? createEmptyBranchForm());
    setManualAddressEntry(false);
    setStepError(null);
    onStepErrorChange?.(null);
  }, [initialValues, onStepErrorChange, reset]);

  useEffect(() => {
    advancingStepRef.current = null;
    setStepError(null);
    onStepErrorChange?.(null);
    if (!activeStep) return;
    const heading = document.querySelector<HTMLElement>("[data-step-heading]");
    heading?.focus();
  }, [activeStep, onStepErrorChange]);

  function updateField<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValue<keyof BranchFormValues>(key, value, { shouldDirty: true, shouldValidate: true });
  }
  function updateAddressField<K extends keyof BranchAddress>(key: K, value: BranchAddress[K]) {
    updateField("address", {
      ...getValues("address"),
      [key]: value,
      ...(["address1", "city", "state", "zipcode", "country"].includes(key) ? { location: null } : {}),
    });
  }
  function applyPlaceToAddress(place: ParsedPlaceAddress) {
    const address = getValues("address");
    updateField("address", {
      ...address,
      address1: place.address1 || address.address1,
      city: place.city || address.city,
      state: place.state || address.state,
      zipcode: place.zipcode || address.zipcode,
      country: place.country || address.country,
      location: place.location ?? null,
    });
  }
  function updateSettingsField<K extends keyof BranchSettings>(key: K, value: BranchSettings[K]) {
    updateField("settings", { ...getValues("settings"), [key]: value });
  }

  const validationError =
    errors.name?.message ||
    (Object.keys(values.settings) as Array<keyof BranchSettings>)
      .map((key) => errors.settings?.[key]?.message)
      .find(Boolean);

  const footerError =
    externalError ||
    stepError ||
    (validationError && !guided ? t(validationError) : undefined);

  function sectionVisible(step: Exclude<BranchFormStep, "review">) {
    return !activeStep || activeStep === step;
  }

  return (
    <form
      id={formId}
      noValidate={guided}
      onSubmit={async (event) => {
        event.preventDefault();
        if (activeStep && activeStep !== "review") {
          if (advancingStepRef.current === activeStep) return;
          advancingStepRef.current = activeStep;
          const fields = getBranchStepFields(activeStep);
          const valid = await trigger(fields, { shouldFocus: true });
          if (valid) {
            setStepError(null);
            onStepErrorChange?.(null);
            onContinue?.();
          } else {
            advancingStepRef.current = null;
            const firstError = fields
              .map((field) => getFieldState(field).error)
              .find(Boolean);
            const message = firstError?.message ? t(firstError.message) : null;
            setStepError(message);
            onStepErrorChange?.(message);
          }
          return;
        }
        if (savingRef.current) return;
        savingRef.current = true;
        try {
          await handleSubmit(onSubmit, (formErrors) => {
            const messageKey =
              formErrors.name?.message ||
              (Object.keys(formErrors.settings ?? {}) as Array<keyof BranchSettings>)
                .map((key) => formErrors.settings?.[key]?.message)
                .find(Boolean);
            const message = messageKey ? t(messageKey) : t("branches.form.validation.nameRequired");
            setStepError(message);
            onStepErrorChange?.(message);
          })(event);
        } finally {
          savingRef.current = false;
        }
      }}
      onKeyDown={handleEnterNavigation}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FormBody
        workflow={guided ? activeStep !== "review" : true}
        isBusy={isSubmitting}
        className={cn(
          guided &&
            "[&_[data-form-section]>div>div>h3]:normal-case [&_[data-form-section]>div>div>h3]:tracking-normal [&_[data-form-section]>div>div>h3]:text-sm [&_[data-form-section]_label]:text-sm [&_[data-form-section]_label]:text-foreground",
          guided && "lg:p-8",
        )}
      >
        {activeStep ? (
          <header className="max-w-2xl space-y-2">
            <div className={cn("flex min-w-0 items-center gap-1", onStepBack && "-ml-2")}>
              {onStepBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.actions.previous")}
                  disabled={stepBackDisabled || isSubmitting}
                  onClick={onStepBack}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}
              <h2
                data-step-heading
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none"
              >
                {t(getBranchStepLabelKey(activeStep))}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(getBranchStepHintKey(activeStep))}
            </p>
          </header>
        ) : null}

        {activeStep === "review" ? (
          <BranchReview values={values} onEdit={onStepChange} />
        ) : null}

        <div
          className={cn(
            !guided &&
              "grid items-start gap-5 @4xl:grid-cols-2 @6xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]",
            guided && activeStep !== "review" && "max-w-2xl",
          )}
        >
          <FormSection
            className={cn(!sectionVisible("branch") && "hidden")}
            variant={guided ? "plain" : "card"}
            icon={guided ? undefined : Building2}
            title={guided ? undefined : `01 · ${t("branches.form.sections.branch")}`}
            description={guided ? undefined : t("branches.form.design.branch")}
          >
            <div className="space-y-4">
              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="name">
                    {t("branches.form.fields.name")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="organization"
                    value={values.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    required
                    aria-invalid={Boolean(errors.name)}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="code">{t("branches.form.fields.code")}</Label>
                  <Input
                    id="code"
                    name="code"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={values.code}
                    onChange={(event) => updateField("code", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="type">{t("branches.form.fields.type")}</Label>
                  <Input
                    id="type"
                    name="type"
                    autoComplete="off"
                    value={values.type}
                    onChange={(event) => updateField("type", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logo">{t("branches.form.fields.logo")}</Label>
                  <Input
                    id="logo"
                    name="logo"
                    autoComplete="url"
                    value={values.logo}
                    onChange={(event) => updateField("logo", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="disclaimer">{t("branches.form.fields.disclaimer")}</Label>
                <Input
                  id="disclaimer"
                  name="disclaimer"
                  value={values.disclaimer}
                  onChange={(event) => updateField("disclaimer", event.target.value)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            className={cn(
              !guided && "@6xl:col-start-2 @6xl:row-span-2 @6xl:row-start-1",
              !sectionVisible("address") && "hidden",
            )}
            variant={guided ? "plain" : "card"}
            icon={guided ? undefined : MapPin}
            title={guided ? undefined : `02 · ${t("branches.form.sections.address")}`}
            description={guided ? undefined : t("branches.form.design.address")}
            action={
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                aria-pressed={manualAddressEntry}
                onClick={() => setManualAddressEntry((current) => !current)}
              >
                {manualAddressEntry ? t("common.address.useGoogle") : t("common.address.useManual")}
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="address-address1" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.address1")}
                  </Label>
                  <AddressAutocompleteInput
                    id="address-address1"
                    value={values.address.address1}
                    onValueChange={(value) => updateAddressField("address1", value)}
                    onPlaceSelected={applyPlaceToAddress}
                    placeholder={t("branches.form.fields.address1")}
                    allowManualEntry
                    className="w-full"
                    onManualEntryChange={setManualAddressEntry}
                    manualEntry={manualAddressEntry}
                    manualEntryTogglePosition="none"
                  />
                </div>
                <div className="w-24 shrink-0 space-y-1">
                  <Label htmlFor="address-apartment" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.apartment")}
                  </Label>
                  <Input
                    id="address-apartment"
                    name="address-apartment"
                    autoComplete="address-line2"
                    value={values.address.apartment}
                    onChange={(event) => updateAddressField("apartment", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address-address2" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.address2")}
                </Label>
                <Input
                  id="address-address2"
                  name="address-address2"
                  value={values.address.address2}
                  onChange={(event) => updateAddressField("address2", event.target.value)}
                  placeholder={t("branches.form.fields.address2")}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="address-city" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.city")}
                  </Label>
                  <Input
                    id="address-city"
                    name="address-city"
                    autoComplete="address-level2"
                    value={values.address.city}
                    onChange={(event) => updateAddressField("city", event.target.value)}
                    disabled={googleMapsConfigured && !manualAddressEntry}
                    readOnly={googleMapsConfigured && !manualAddressEntry}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address-state" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.state")}
                  </Label>
                  <Input
                    id="address-state"
                    name="address-state"
                    autoComplete="address-level1"
                    value={values.address.state}
                    onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                    disabled={googleMapsConfigured && !manualAddressEntry}
                    readOnly={googleMapsConfigured && !manualAddressEntry}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address-zipcode" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.zipcode")}
                  </Label>
                  <Input
                    id="address-zipcode"
                    name="address-zipcode"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={values.address.zipcode}
                    onChange={(event) => updateAddressField("zipcode", event.target.value)}
                    disabled={googleMapsConfigured && !manualAddressEntry}
                    readOnly={googleMapsConfigured && !manualAddressEntry}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address-country" className="text-xs text-muted-foreground">
                    {t("branches.form.fields.country")}
                  </Label>
                  <Input
                    id="address-country"
                    name="address-country"
                    autoComplete="country"
                    value={values.address.country}
                    onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
                    disabled={googleMapsConfigured && !manualAddressEntry}
                    readOnly={googleMapsConfigured && !manualAddressEntry}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            className={cn(
              !guided && "@4xl:col-start-1 @4xl:row-start-2",
              !sectionVisible("contact") && "hidden",
            )}
            variant={guided ? "plain" : "card"}
            icon={guided ? undefined : Phone}
            title={guided ? undefined : `03 · ${t("branches.form.sections.contact")}`}
            description={guided ? undefined : t("branches.form.design.contact")}
          >
            <div className="space-y-1">
              <PhoneListEditor
                idPrefix="branch-phone"
                compact
                listClassName="[&>div>div:first-child]:w-32 [&>div>div:first-child]:sm:w-32 max-md:[&>div]:flex-wrap max-md:[&>div>div:first-child]:basis-full"
                phones={values.phones}
                onChange={(phones) => updateField("phones", phones)}
              />
            </div>
          </FormSection>

          <FormSection
            className={cn(
              !guided && "@6xl:col-start-3 @6xl:row-span-2 @6xl:row-start-1",
              !sectionVisible("settings") && "hidden",
            )}
            variant={guided ? "plain" : "card"}
            icon={guided ? undefined : Settings}
            title={guided ? undefined : `04 · ${t("branches.form.sections.settings")}`}
            description={guided ? undefined : t("branches.form.design.settings")}
          >
            <div className="space-y-3">
              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-labelPrefix">{t("branches.form.fields.labelPrefix")}</Label>
                  <Input
                    id="settings-labelPrefix"
                    name="settings-labelPrefix"
                    autoComplete="off"
                    value={values.settings.labelPrefix}
                    onChange={(event) => updateSettingsField("labelPrefix", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-roundDecimalPlaces">
                    {t("branches.form.fields.roundDecimalPlaces")}
                  </Label>
                  <Input
                    id="settings-roundDecimalPlaces"
                    name="settings-roundDecimalPlaces"
                    type="number"
                    inputMode="numeric"
                    value={values.settings.roundDecimalPlaces}
                    onChange={(event) =>
                      updateSettingsField("roundDecimalPlaces", Number(event.target.value) || 0)
                    }
                    aria-invalid={Boolean(errors.settings?.roundDecimalPlaces)}
                  />
                </div>
              </div>

              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-defaultLabelStatus">
                    {t("branches.form.fields.defaultLabelStatus")}
                  </Label>
                  <Input
                    id="settings-defaultLabelStatus"
                    name="settings-defaultLabelStatus"
                    type="number"
                    inputMode="numeric"
                    value={values.settings.defaultLabelStatus || ""}
                    placeholder={t("branches.form.defaultLabelStatusUnconfigured")}
                    aria-describedby="settings-defaultLabelStatus-help"
                    onChange={(event) =>
                      updateSettingsField("defaultLabelStatus", Number(event.target.value) || 0)
                    }
                  />
                  <p id="settings-defaultLabelStatus-help" className="text-xs text-muted-foreground">
                    {t("branches.form.defaultLabelStatusHelp")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-imageResampleBy">
                    {t("branches.form.fields.imageResampleBy")}
                  </Label>
                  <Input
                    id="settings-imageResampleBy"
                    name="settings-imageResampleBy"
                    type="number"
                    inputMode="numeric"
                    value={values.settings.imageResampleBy}
                    onChange={(event) =>
                      updateSettingsField("imageResampleBy", Number(event.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-s3Profile">{t("branches.form.fields.s3Profile")}</Label>
                  <Input
                    id="settings-s3Profile"
                    name="settings-s3Profile"
                    autoComplete="off"
                    value={values.settings.s3Profile}
                    onChange={(event) => updateSettingsField("s3Profile", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-s3BucketName">{t("branches.form.fields.s3BucketName")}</Label>
                  <Input
                    id="settings-s3BucketName"
                    name="settings-s3BucketName"
                    autoComplete="off"
                    value={values.settings.s3BucketName}
                    onChange={(event) => updateSettingsField("s3BucketName", event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 @4xl:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="settings-s3BucketFolder">{t("branches.form.fields.s3BucketFolder")}</Label>
                  <Input
                    id="settings-s3BucketFolder"
                    name="settings-s3BucketFolder"
                    autoComplete="off"
                    value={values.settings.s3BucketFolder}
                    onChange={(event) => updateSettingsField("s3BucketFolder", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="settings-s3ShareLinkExpireMinutes">
                    {t("branches.form.fields.s3ShareLinkExpireMinutes")}
                  </Label>
                  <Input
                    id="settings-s3ShareLinkExpireMinutes"
                    name="settings-s3ShareLinkExpireMinutes"
                    type="number"
                    inputMode="numeric"
                    value={values.settings.s3ShareLinkExpireMinutes}
                    onChange={(event) =>
                      updateSettingsField("s3ShareLinkExpireMinutes", Number(event.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <SwitchField
                  id="settings-invoiceCreatedThruIncomeStatement"
                  label={
                    <>
                      {t("branches.form.fields.invoiceCreatedThruIncomeStatement")}:{" "}
                      {t(
                        values.settings.invoiceCreatedThruIncomeStatement
                          ? "branches.enums.boolean.true"
                          : "branches.enums.boolean.false",
                      )}
                    </>
                  }
                  checked={values.settings.invoiceCreatedThruIncomeStatement}
                  onCheckedChange={(checked) =>
                    updateSettingsField("invoiceCreatedThruIncomeStatement", checked)
                  }
                />
                <SwitchField
                  id="settings-printLabelCount"
                  label={
                    <>
                      {t("branches.form.fields.printLabelCount")}:{" "}
                      {t(
                        values.settings.printLabelCount
                          ? "branches.enums.boolean.true"
                          : "branches.enums.boolean.false",
                      )}
                    </>
                  }
                  checked={values.settings.printLabelCount}
                  onCheckedChange={(checked) => updateSettingsField("printLabelCount", checked)}
                />
              </div>
            </div>
          </FormSection>
        </div>
      </FormBody>

      {!hideFooter ? (
        <FormFooter
          error={footerError || undefined}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
        />
      ) : null}
    </form>
  );
}
