"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

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
  onChange?: (permissions: RolePermissionFormValues[]) => void;
  readOnly?: boolean;
  showPermissionValues?: boolean;
  defaultExpanded?: boolean;
};

export function RolePermissionsEditor({
  permissions,
  onChange,
  readOnly = false,
  showPermissionValues = true,
  defaultExpanded = true,
}: RolePermissionsEditorProps) {
  const catalogGroups = getPermissionCatalogGroups();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(defaultExpanded ? catalogGroups : [])
  );

  const assignedValues = useMemo(
    () => new Set(permissions.map((permission) => permission.value.trim()).filter(Boolean)),
    [permissions]
  );

  function togglePermission(value: string, checked: boolean) {
    if (readOnly || !onChange) return;

    if (checked) {
      onChange([...permissions, { id: createPermissionId(), value }]);
      return;
    }

    onChange(permissions.filter((permission) => permission.value !== value));
  }

  function toggleGroup(group: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

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
            <h4>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                aria-expanded={expandedGroups.has(group)}
                aria-controls={`permission-group-${groupIndex}`}
                onClick={() => toggleGroup(group)}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    expandedGroups.has(group) ? "rotate-180" : ""
                  }`}
                />
              </button>
            </h4>
            {expandedGroups.has(group) ? (
              <div id={`permission-group-${groupIndex}`} className="divide-y">
                {getPermissionsByGroup(group).map((entry) => {
                  const isAssigned = assignedValues.has(entry.value);
                  return (
                    <label
                      key={entry.value}
                      htmlFor={`permission-${entry.value}`}
                      className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${
                        readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted/30"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{entry.label}</span>
                        {showPermissionValues ? (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {entry.value}
                          </span>
                        ) : null}
                      </span>
                      <Switch
                        id={`permission-${entry.value}`}
                        checked={isAssigned}
                        disabled={readOnly}
                        className={readOnly ? "disabled:cursor-default disabled:opacity-100" : undefined}
                        onCheckedChange={
                          readOnly ? undefined : (checked) => togglePermission(entry.value, checked)
                        }
                        aria-label={`${entry.label} permission`}
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
