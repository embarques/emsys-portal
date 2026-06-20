"use client";

import { useMemo } from "react";

import { Switch } from "@/components/ui/switch";
import {
  getPermissionCatalogGroups,
  getPermissionsByGroup,
} from "@/lib/roles/permissions-catalog";
import {
  createPermissionId,
  type RolePermissionFormValues,
} from "@/lib/roles/types";

type RolePermissionsEditorProps = {
  permissions: RolePermissionFormValues[];
  onChange: (permissions: RolePermissionFormValues[]) => void;
};

export function RolePermissionsEditor({
  permissions,
  onChange,
}: RolePermissionsEditorProps) {
  const assignedValues = useMemo(
    () => new Set(permissions.map((permission) => permission.value.trim()).filter(Boolean)),
    [permissions]
  );

  function togglePermission(value: string, checked: boolean) {
    if (checked) {
      onChange([...permissions, { id: createPermissionId(), value }]);
      return;
    }

    onChange(permissions.filter((permission) => permission.value !== value));
  }

  const catalogGroups = getPermissionCatalogGroups();

  return (
    <section className="space-y-4" aria-labelledby="permissions-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="permissions-heading" className="text-sm font-semibold">Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Choose what this role is allowed to access.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {assignedValues.size} selected
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border">
        {catalogGroups.map((group, groupIndex) => (
          <div key={group} className={groupIndex > 0 ? "border-t" : undefined}>
            <div className="bg-muted/40 px-4 py-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h4>
            </div>
            <div className="divide-y">
              {getPermissionsByGroup(group).map((entry) => {
                const isAssigned = assignedValues.has(entry.value);
                return (
                  <label
                    key={entry.value}
                    htmlFor={`permission-${entry.value}`}
                    className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{entry.label}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{entry.value}</span>
                    </span>
                    <Switch
                      id={`permission-${entry.value}`}
                      checked={isAssigned}
                      onCheckedChange={(checked) => togglePermission(entry.value, checked)}
                      aria-label={`${entry.label} permission`}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
