"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleFormSchema } from "@/lib/roles/schemas/role.schema";
import {
  createEmptyRoleForm,
  type RoleFormValues,
} from "@/lib/roles/types";

type RoleFormProps = {
  initialValues?: RoleFormValues;
  error?: string | null;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
};

export function RoleForm({
  initialValues,
  error,
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

  useEffect(() => {
    reset(initialValues ?? createEmptyRoleForm());
  }, [initialValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
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
            <RolePermissionsEditor permissions={field.value} onChange={field.onChange} />
          )}
        />

        {errors.permissions?.message ? (
          <p className="text-sm text-destructive">{errors.permissions.message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
