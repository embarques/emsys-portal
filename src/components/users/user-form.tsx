"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Clock, KeyRound, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useRoles } from "@/lib/roles/hooks/use-roles";
import { DEFAULT_ROLE_LIST_PARAMS } from "@/lib/roles/types";
import { createUserFormSchema } from "@/lib/users/schemas/user.schema";
import { createEmptyUserForm, USER_ACTIVE_OPTIONS, type UserFormValues } from "@/lib/users/types";
import { cn } from "@/lib/utils";

type Props = {
  initialValues?: UserFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function UserForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const branchesQuery = useBranchPicker(200);
  const rolesQuery = useRoles({ ...DEFAULT_ROLE_LIST_PARAMS, limit: 200 });

  const userFormSchema = useMemo(
    () =>
      createUserFormSchema(isEditing, {
        selectOption: t("users.form.validation.selectOption"),
        validEmail: t("users.form.validation.validEmail"),
        nameRequired: t("users.form.validation.nameRequired"),
        validTime: t("users.form.validation.validTime"),
        startTimeRequired: t("users.form.validation.startTimeRequired"),
        endTimeRequired: t("users.form.validation.endTimeRequired"),
        passwordMinLength: t("users.form.validation.passwordMinLength"),
        confirmPasswordRequired: t("users.form.validation.confirmPasswordRequired"),
        passwordsDoNotMatch: t("users.form.validation.passwordsDoNotMatch"),
      }),
    [isEditing, t],
  );

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: initialValues ?? createEmptyUserForm(),
    mode: "onChange",
  });
  const handleEnterNavigation = useFormEnterNavigation();
  const restrictLoginHours = useWatch({ control, name: "restrictLoginHours" });
  const selectedRole = useWatch({ control, name: "role" });
  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });
  const passwordValid = password.length >= 6;
  const passwordInvalid = Boolean(password) && !passwordValid;
  const confirmationValid = Boolean(confirmPassword) && confirmPassword === password;
  const confirmationInvalid = Boolean(confirmPassword) && !confirmationValid;

  const activeOptions = useMemo(
    () =>
      USER_ACTIVE_OPTIONS.map((option) => ({
        value: String(option.value),
        label: t(option.value ? "users.enums.status.active" : "users.enums.status.inactive"),
      })),
    [t],
  );

  useEffect(() => reset(initialValues ?? createEmptyUserForm()), [initialValues, reset]);

  const branches = branchesQuery.data?.items ?? [];
  const roles = useMemo(
    () => (rolesQuery.data?.items ?? []).filter((role) => role.active),
    [rolesQuery.data?.items],
  );

  useEffect(() => {
    if (isEditing || selectedRole.id > 0) return;
    const defaultRole = roles.find((role) => role.name.trim().toLowerCase() === "user");
    if (!defaultRole) return;
    const defaultRoleId = Number(defaultRole.roleId);
    if (!Number.isInteger(defaultRoleId) || defaultRoleId <= 0) return;

    setValue(
      "role",
      { id: defaultRoleId, name: defaultRole.name },
      { shouldDirty: false, shouldValidate: true },
    );
  }, [isEditing, roles, selectedRole.id, setValue]);

  const selectorsLoading = branchesQuery.isLoading || rolesQuery.isLoading;
  const selectorError = branchesQuery.error ?? rolesQuery.error;
  const noOptions = !selectorsLoading && !selectorError && (branches.length === 0 || roles.length === 0);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={handleEnterNavigation}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FormBody>
        <FormSection icon={KeyRound} title={t("users.form.sections.profile")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("users.form.fields.email")} required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder={t("users.form.placeholders.email")}
                aria-invalid={Boolean(errors.email)}
                readOnly={isEditing}
                autoFocus
              />
            </Field>
            <Field label={t("users.form.fields.name")} required error={errors.name?.message}>
              <Input
                id="name"
                {...register("name")}
                placeholder={t("users.form.placeholders.name")}
                aria-invalid={Boolean(errors.name)}
              />
            </Field>
          </div>
          {!isEditing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("users.form.fields.password")} required>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder={t("users.form.placeholders.password")}
                  autoComplete="new-password"
                  aria-invalid={passwordInvalid || Boolean(errors.password)}
                  aria-describedby="password-status"
                  className={passwordFieldClassName(passwordValid, passwordInvalid || Boolean(errors.password))}
                />
                <PasswordStatus
                  id="password-status"
                  valid={passwordValid}
                  invalid={passwordInvalid || Boolean(errors.password)}
                  message={
                    passwordValid
                      ? t("users.form.password.valid")
                      : (errors.password?.message ?? t("users.form.password.minLength"))
                  }
                />
              </Field>
              <Field label={t("users.form.fields.confirmPassword")} required>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...register("confirmPassword")}
                  placeholder={t("users.form.placeholders.confirmPassword")}
                  autoComplete="new-password"
                  aria-invalid={confirmationInvalid || Boolean(errors.confirmPassword)}
                  aria-describedby="confirm-password-status"
                  className={passwordFieldClassName(
                    confirmationValid,
                    confirmationInvalid || Boolean(errors.confirmPassword),
                  )}
                />
                <PasswordStatus
                  id="confirm-password-status"
                  valid={confirmationValid}
                  invalid={confirmationInvalid || Boolean(errors.confirmPassword)}
                  message={
                    confirmationValid
                      ? t("users.form.password.match")
                      : (errors.confirmPassword?.message ??
                        (confirmationInvalid
                          ? t("users.form.password.mismatch")
                          : t("users.form.password.reenter")))
                  }
                />
              </Field>
            </div>
          ) : null}
        </FormSection>

        <FormSection icon={ShieldCheck} title={t("users.form.sections.access")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Field label={t("users.form.fields.active")} required>
                  <SearchableSelect
                    id="active"
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(value === "true")}
                    options={activeOptions}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="branch"
              render={({ field }) => (
                <Field label={t("users.form.fields.branch")} required error={errors.branch?.id?.message}>
                  <SearchableSelect
                    id="branch"
                    value={field.value.id ? String(field.value.id) : ""}
                    disabled={branchesQuery.isLoading || branches.length === 0}
                    placeholder={
                      branchesQuery.isLoading
                        ? t("users.form.placeholders.branchLoading")
                        : t("users.form.placeholders.branch")
                    }
                    searchPlaceholder={t("users.form.placeholders.branchSearch")}
                    onValueChange={(value) => {
                      const branch = branches.find((item) => item.id === Number(value));
                      field.onChange({
                        id: branch?.id ?? 0,
                        code: branch?.code ?? "",
                        name: branch?.name ?? "",
                      });
                    }}
                    options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field label={t("users.form.fields.role")} required error={errors.role?.id?.message}>
                  <SearchableSelect
                    id="role"
                    value={field.value.id ? String(field.value.id) : ""}
                    disabled={rolesQuery.isLoading || roles.length === 0}
                    placeholder={
                      rolesQuery.isLoading
                        ? t("users.form.placeholders.roleLoading")
                        : t("users.form.placeholders.role")
                    }
                    searchPlaceholder={t("users.form.placeholders.roleSearch")}
                    onValueChange={(value) => {
                      const role = roles.find((item) => Number(item.roleId) === Number(value));
                      field.onChange({ id: Number(role?.roleId ?? 0), name: role?.name ?? "" });
                    }}
                    options={roles.map((role) => ({ value: String(role.roleId), label: role.name }))}
                  />
                </Field>
              )}
            />
          </div>
          {selectorError ? (
            <p className="text-sm text-destructive">
              {t("users.form.errors.loadAccessOptions", {
                message: normalizeApiError(selectorError).message,
              })}
            </p>
          ) : null}
          {noOptions ? (
            <p className="text-sm text-muted-foreground">{t("users.form.errors.noAccessOptions")}</p>
          ) : null}
        </FormSection>

        <FormSection icon={Clock} title={t("users.form.sections.loginHours")}>
          <Controller
            control={control}
            name="restrictLoginHours"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="restrictLoginHours">{t("users.form.fields.restrictLoginHours")}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("users.form.fields.restrictLoginHoursHint")}
                  </p>
                </div>
                <Switch id="restrictLoginHours" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {restrictLoginHours ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("users.form.fields.startTime")} required error={errors.startTime?.message}>
                <Input
                  id="startTime"
                  type="time"
                  {...register("startTime")}
                  aria-invalid={Boolean(errors.startTime)}
                />
              </Field>
              <Field label={t("users.form.fields.endTime")} required error={errors.endTime?.message}>
                <Input
                  id="endTime"
                  type="time"
                  {...register("endTime")}
                  aria-invalid={Boolean(errors.endTime)}
                />
              </Field>
            </div>
          ) : null}
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={selectorsLoading || noOptions}
        onCancel={onCancel}
      />
    </form>
  );
}

function passwordFieldClassName(valid: boolean, invalid: boolean): string | undefined {
  if (valid) {
    return "border-emerald-600 focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20";
  }
  if (invalid) {
    return "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20";
  }
  return undefined;
}

function PasswordStatus({
  id,
  valid,
  invalid,
  message,
}: {
  id: string;
  valid: boolean;
  invalid: boolean;
  message: string;
}) {
  const Icon = valid ? CheckCircle2 : invalid ? XCircle : null;

  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs",
        valid && "text-emerald-600 dark:text-emerald-400",
        invalid && "text-destructive",
        !valid && !invalid && "text-muted-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {message}
    </p>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
