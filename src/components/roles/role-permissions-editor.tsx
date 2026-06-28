"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getPermissionCatalogGroups,
  getPermissionsByGroup,
  type PermissionCatalogEntry,
} from "@/lib/roles/permissions-catalog";
import {
  type RolePermissionFormValues,
} from "@/lib/roles/types";

type RolePermissionsEditorProps = {
  permissions: RolePermissionFormValues[];
  catalog: PermissionCatalogEntry[];
  onChange?: (permissions: RolePermissionFormValues[]) => void;
  readOnly?: boolean;
  showPermissionValues?: boolean;
  defaultExpanded?: boolean;
};

export function RolePermissionsEditor({
  permissions,
  catalog,
  onChange,
  readOnly = false,
  showPermissionValues = true,
  defaultExpanded = false,
}: RolePermissionsEditorProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!normalizedSearch) return catalog;
    return catalog.filter((entry) => {
      return (
        entry.label.toLowerCase().includes(normalizedSearch) ||
        entry.value.toLowerCase().includes(normalizedSearch) ||
        entry.group.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [catalog, normalizedSearch]);

  const catalogGroups = useMemo(
    () => getPermissionCatalogGroups(filteredCatalog),
    [filteredCatalog],
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(defaultExpanded ? catalogGroups : [])
  );

  const assignedIds = useMemo(
    () => new Set(permissions.map((permission) => permission.id.trim()).filter(Boolean)),
    [permissions],
  );

  const assignedValues = useMemo(
    () => new Set(permissions.map((permission) => permission.value.trim()).filter(Boolean)),
    [permissions],
  );

  useEffect(() => {
    if (!defaultExpanded && !normalizedSearch) return;

    setExpandedGroups((current) => new Set([...current, ...catalogGroups]));
  }, [catalogGroups, defaultExpanded, normalizedSearch]);

  function isEntryAssigned(entry: PermissionCatalogEntry) {
    return assignedIds.has(entry.id) || assignedValues.has(entry.value);
  }

  function togglePermission(entry: PermissionCatalogEntry, checked: boolean) {
    if (readOnly || !onChange) return;

    if (checked) {
      onChange([...permissions, { id: entry.id, value: entry.value }]);
      return;
    }

    onChange(permissions.filter((permission) => permission.value !== entry.value));
  }

  function setEntriesAssigned(entries: PermissionCatalogEntry[], checked: boolean) {
    if (readOnly || !onChange || entries.length === 0) return;

    if (checked) {
      const additions = entries
        .filter((entry) => !isEntryAssigned(entry))
        .map((entry) => ({ id: entry.id, value: entry.value }));
      if (additions.length === 0) return;
      onChange([...permissions, ...additions]);
      return;
    }

    const removeValues = new Set(entries.map((entry) => entry.value));
    const removeIds = new Set(entries.map((entry) => entry.id));
    onChange(
      permissions.filter(
        (permission) => !removeValues.has(permission.value) && !removeIds.has(permission.id),
      ),
    );
  }

  const allSelected =
    filteredCatalog.length > 0 && filteredCatalog.every((entry) => isEntryAssigned(entry));

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

      {catalog.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search permissions…"
            className="pl-9"
            aria-label="Search permissions"
          />
        </div>
      ) : null}

      {!readOnly && catalogGroups.length > 0 ? (
        <label
          htmlFor="permission-select-all"
          className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed px-4 py-2.5 transition-colors hover:bg-muted/30"
        >
          <span className="text-sm font-medium">
            {normalizedSearch ? "Select all matching permissions" : "Select all permissions"}
          </span>
          <Switch
            id="permission-select-all"
            checked={allSelected}
            onCheckedChange={(checked) => setEntriesAssigned(filteredCatalog, checked)}
            aria-label="Select all permissions"
          />
        </label>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        {catalog.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading permissions…</p>
        ) : catalogGroups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No permissions match “{search.trim()}”.
          </p>
        ) : (
          catalogGroups.map((group, groupIndex) => {
            const groupEntries = getPermissionsByGroup(group, filteredCatalog);
            const groupAllSelected =
              groupEntries.length > 0 && groupEntries.every((entry) => isEntryAssigned(entry));
            return (
          <div key={group} className={groupIndex > 0 ? "border-t" : undefined}>
            <h4 className="flex items-center justify-between gap-3 bg-muted/40 pr-4">
              <button
                type="button"
                className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
                aria-expanded={expandedGroups.has(group)}
                aria-controls={`permission-group-${groupIndex}`}
                onClick={() => toggleGroup(group)}
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    expandedGroups.has(group) ? "rotate-180" : ""
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </span>
              </button>
              {!readOnly ? (
                <Switch
                  checked={groupAllSelected}
                  onCheckedChange={(checked) => setEntriesAssigned(groupEntries, checked)}
                  aria-label={`Select all ${group} permissions`}
                />
              ) : null}
            </h4>
            {expandedGroups.has(group) ? (
              <div id={`permission-group-${groupIndex}`} className="divide-y">
                {groupEntries.map((entry) => {
                  const isAssigned = assignedIds.has(entry.id) || assignedValues.has(entry.value);
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
                          readOnly ? undefined : (checked) => togglePermission(entry, checked)
                        }
                        aria-label={`${entry.label} permission`}
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
            );
          })
        )}
      </div>
    </section>
  );
}
