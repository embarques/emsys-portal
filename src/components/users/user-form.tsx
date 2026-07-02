"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, KeyRound, ShieldCheck } from "lucide-react";
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
import { useRoles } from "@/lib/roles/hooks/use-roles";
import { DEFAULT_ROLE_LIST_PARAMS } from "@/lib/roles/types";
import { createUserFormSchema } from "@/lib/users/schemas/user.schema";
import { createEmptyUserForm, USER_ACTIVE_OPTIONS, type UserFormValues } from "@/lib/users/types";

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
  const branchesQuery = useBranchPicker(200);
  const rolesQuery = useRoles({ ...DEFAULT_ROLE_LIST_PARAMS, limit: 200 });
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(createUserFormSchema(isEditing)),
    defaultValues: initialValues ?? createEmptyUserForm(),
  });
  const handleEnterNavigation = useFormEnterNavigation();
  const restrictLoginHours = useWatch({ control, name: "restrictLoginHours" });
  const selectedRole = useWatch({ control, name: "role" });

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
        <FormSection icon={KeyRound} title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" required error={errors.email?.message}>
              <Input id="email" type="email" {...register("email")} placeholder="user@example.com" aria-invalid={Boolean(errors.email)} readOnly={isEditing} autoFocus />
            </Field>
            <Field label="Full name" required error={errors.name?.message}>
              <Input id="name" {...register("name")} placeholder="Full name" aria-invalid={Boolean(errors.name)} />
            </Field>
          </div>
          {!isEditing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" required error={errors.password?.message}>
                <Input id="password" type="password" {...register("password")} placeholder="At least 6 characters" autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
              </Field>
              <Field label="Confirm password" required error={errors.confirmPassword?.message}>
                <Input id="confirmPassword" type="password" {...register("confirmPassword")} placeholder="Repeat new password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} />
              </Field>
            </div>
          ) : null}
        </FormSection>

        <FormSection icon={ShieldCheck} title="Access">
          <div className="grid gap-3 sm:grid-cols-3">
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Field label="Status" required>
                  <SearchableSelect id="active" value={String(field.value)} onValueChange={(value) => field.onChange(value === "true")} options={USER_ACTIVE_OPTIONS.map((option) => ({ value: String(option.value), label: option.label }))} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="branch"
              render={({ field }) => (
                <Field label="Branch" required error={errors.branch?.id?.message}>
                  <SearchableSelect id="branch" value={field.value.id ? String(field.value.id) : ""} disabled={branchesQuery.isLoading || branches.length === 0} placeholder={branchesQuery.isLoading ? "Loading branches…" : "Select branch"} searchPlaceholder="Search branches…" onValueChange={(value) => { const branch = branches.find((item) => item.id === Number(value)); field.onChange({ id: branch?.id ?? 0, name: branch?.name ?? "" }); }} options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Field label="Role" required error={errors.role?.id?.message}>
                  <SearchableSelect id="role" value={field.value.id ? String(field.value.id) : ""} disabled={rolesQuery.isLoading || roles.length === 0} placeholder={rolesQuery.isLoading ? "Loading roles…" : "Select role"} searchPlaceholder="Search roles…" onValueChange={(value) => { const role = roles.find((item) => Number(item.roleId) === Number(value)); field.onChange({ id: Number(role?.roleId ?? 0), name: role?.name ?? "" }); }} options={roles.map((role) => ({ value: String(role.roleId), label: role.name }))} />
                </Field>
              )}
            />
          </div>
          {selectorError ? <p className="text-sm text-destructive">Unable to load access options: {normalizeApiError(selectorError).message}</p> : null}
          {noOptions ? <p className="text-sm text-muted-foreground">No active branches or roles are available.</p> : null}
        </FormSection>

        <FormSection icon={Clock} title="Login hours">
          <Controller
            control={control}
            name="restrictLoginHours"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="restrictLoginHours">Restrict login hours</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Limits when this user can access the system each day.</p>
                </div>
                <Switch id="restrictLoginHours" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {restrictLoginHours ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start time" required error={errors.startTime?.message}>
                <Input id="startTime" type="time" {...register("startTime")} aria-invalid={Boolean(errors.startTime)} />
              </Field>
              <Field label="End time" required error={errors.endTime?.message}>
                <Input id="endTime" type="time" {...register("endTime")} aria-invalid={Boolean(errors.endTime)} />
              </Field>
            </div>
          ) : null}
        </FormSection>
      </FormBody>

      <FormFooter error={externalError} submitLabel={submitLabel} isSubmitting={isSubmitting} submitDisabled={selectorsLoading || noOptions} onCancel={onCancel} />
    </form>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required ? <span className="text-destructive"> *</span> : null}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
