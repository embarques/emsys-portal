"use client";

import { useEffect, useState } from "react";

import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmptyRoleForm,
  normalizePermissions,
  type Role,
  type RoleFormValues,
} from "@/lib/roles/types";

type RoleFormProps = {
  initialValues?: RoleFormValues;
  existingRoles?: Role[];
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
};

export function RoleForm({
  initialValues,
  existingRoles = [],
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: RoleFormProps) {
  const [values, setValues] = useState<RoleFormValues>(initialValues ?? createEmptyRoleForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues ?? createEmptyRoleForm());
    setFormError(null);
  }, [initialValues]);

  function updateField<K extends keyof RoleFormValues>(key: K, value: RoleFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const permissions = normalizePermissions(values.permissions);
    if (permissions.length === 0) {
      setFormError("Add at least one permission.");
      return;
    }

    if (!values.name.trim()) {
      setFormError("Role name is required.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="roleId">Role ID</Label>
          <Input id="roleId" value={values.roleId} readOnly className="bg-muted/40 font-mono text-xs" />
          {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new roles.</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Role name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Operations Manager"
            required
          />
        </div>
      </div>

      <RolePermissionsEditor
        permissions={values.permissions}
        existingRoles={existingRoles}
        currentRoleId={values.roleId}
        showCopyFrom={!isEditing}
        onChange={(permissions) => updateField("permissions", permissions)}
      />

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
