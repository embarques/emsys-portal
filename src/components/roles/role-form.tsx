"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Shield } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleFormSchema } from "@/lib/roles/schemas/role.schema";
import type { PermissionCatalogEntry } from "@/lib/roles/permissions-catalog";
import {
  createEmptyRoleForm,
  type RoleFormValues,
} from "@/lib/roles/types";

type RoleFormProps = {
  initialValues?: RoleFormValues;
  permissionCatalog: PermissionCatalogEntry[];
  error?: string | null;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
};

export function RoleForm({
  initialValues,
  permissionCatalog,
  error,
  isSubmitting = false,
  submitLabel,
  onSubmit,
  onCancel,
}: RoleFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: initialValues ?? createEmptyRoleForm(),
  });
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    reset(initialValues ?? createEmptyRoleForm());
  }, [initialValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={Shield} title="Role">
          <div className="space-y-1">
            <Label htmlFor="name">
              Role name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Operations Manager"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>
        </FormSection>

        <Controller
          control={control}
          name="permissions"
          render={({ field }) => (
            <RolePermissionsEditor
              permissions={field.value}
              catalog={permissionCatalog}
              onChange={field.onChange}
            />
          )}
        />

        {errors.permissions?.message ? (
          <p className="text-sm text-destructive">{errors.permissions.message}</p>
        ) : null}
      </FormBody>

      <FormFooter
        error={error}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
