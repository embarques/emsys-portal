"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { Button } from "@/components/ui/button";
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
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
        <div className="space-y-2">
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
