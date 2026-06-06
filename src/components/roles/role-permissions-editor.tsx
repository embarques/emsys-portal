"use client";

import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPermissionCatalogGroups,
  getPermissionLabel,
  getPermissionsByGroup,
} from "@/lib/roles/permissions-catalog";
import {
  createEmptyPermission,
  createPermissionId,
  type Role,
  type RolePermissionFormValues,
} from "@/lib/roles/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type RolePermissionsEditorProps = {
  permissions: RolePermissionFormValues[];
  existingRoles?: Role[];
  currentRoleId?: string;
  showCopyFrom?: boolean;
  onChange: (permissions: RolePermissionFormValues[]) => void;
};

export function RolePermissionsEditor({
  permissions,
  existingRoles = [],
  currentRoleId,
  showCopyFrom = false,
  onChange,
}: RolePermissionsEditorProps) {
  const [copyFromRoleId, setCopyFromRoleId] = useState("");

  const copySourceRoles = useMemo(
    () => existingRoles.filter((role) => role.roleId !== currentRoleId),
    [currentRoleId, existingRoles]
  );

  const assignedValues = useMemo(
    () => new Set(permissions.map((permission) => permission.value.trim()).filter(Boolean)),
    [permissions]
  );

  function updatePermission(index: number, value: string) {
    onChange(permissions.map((permission, permissionIndex) => (permissionIndex === index ? { ...permission, value } : permission)));
  }

  function addPermission(initialValue = "") {
    onChange([...permissions, { id: createPermissionId(), value: initialValue }]);
  }

  function removePermission(index: number) {
    if (permissions.length <= 1) {
      onChange([createEmptyPermission()]);
      return;
    }
    onChange(permissions.filter((_, permissionIndex) => permissionIndex !== index));
  }

  function addCatalogPermission(value: string) {
    if (assignedValues.has(value)) return;
    const hasEmptyRow = permissions.some((permission) => !permission.value.trim());
    if (hasEmptyRow) {
      onChange(
        permissions.map((permission) =>
          !permission.value.trim() ? { ...permission, value } : permission
        )
      );
      return;
    }
    addPermission(value);
  }

  function handleCopyFromRole(roleId: string) {
    setCopyFromRoleId(roleId);
    if (!roleId) return;

    const sourceRole = existingRoles.find((role) => role.roleId === roleId);
    if (!sourceRole) return;

    onChange(
      sourceRole.permissions.map((permission) => ({
        id: createPermissionId(),
        value: permission.value,
      }))
    );
  }

  const catalogGroups = getPermissionCatalogGroups();

  return (
    <section className="space-y-4">
      {showCopyFrom && copySourceRoles.length > 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/10 p-4">
          <div className="flex items-start gap-3">
            <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Label htmlFor="copyFromRole">Copy from existing role</Label>
                <p className="text-xs text-muted-foreground">
                  Start with another role&apos;s permissions, then add, edit, or remove as needed.
                </p>
              </div>
              <select
                id="copyFromRole"
                className={selectClassName}
                value={copyFromRoleId}
                onChange={(event) => handleCopyFromRole(event.target.value)}
              >
                <option value="">Select a role to copy…</option>
                {copySourceRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>
                    {role.name} ({role.permissions.length} permissions)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Add, edit, or remove permissions for this role.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => addPermission()}>
          <Plus className="h-4 w-4" />
          Add permission
        </Button>
      </div>

      <div className="space-y-3">
        {permissions.map((permission, index) => (
          <div key={permission.id} className="flex items-start gap-2 rounded-xl border bg-muted/10 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor={`permission-${permission.id}`} className="text-xs text-muted-foreground">
                Permission {index + 1}
              </Label>
              <Input
                id={`permission-${permission.id}`}
                value={permission.value}
                onChange={(event) => updatePermission(index, event.target.value)}
                placeholder="e.g. customers.view"
                list="permission-catalog-options"
              />
              {permission.value.trim() ? (
                <p className="text-xs text-muted-foreground">{getPermissionLabel(permission.value.trim())}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-6 shrink-0 text-destructive hover:text-destructive"
              onClick={() => removePermission(index)}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ))}
      </div>

      <datalist id="permission-catalog-options">
        {catalogGroups.flatMap((group) =>
          getPermissionsByGroup(group).map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))
        )}
      </datalist>

      <div className="space-y-3 rounded-xl border bg-muted/5 p-4">
        <div>
          <h4 className="text-sm font-medium">Quick add from catalog</h4>
          <p className="text-xs text-muted-foreground">
            Click a permission to add it to the list above.
          </p>
        </div>

        {catalogGroups.map((group) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
            <div className="flex flex-wrap gap-2">
              {getPermissionsByGroup(group).map((entry) => {
                const isAssigned = assignedValues.has(entry.value);
                return (
                  <Button
                    key={entry.value}
                    type="button"
                    size="sm"
                    variant={isAssigned ? "secondary" : "outline"}
                    disabled={isAssigned}
                    onClick={() => addCatalogPermission(entry.value)}
                  >
                    {entry.label}
                    {isAssigned ? (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        Added
                      </Badge>
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
