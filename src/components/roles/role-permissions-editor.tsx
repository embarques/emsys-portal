"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";
import {
  getPermissionCatalogGroups,
  getPermissionsByAction,
  getPermissionsByGroup,
  PERMISSION_BULK_ACTIONS,
  type PermissionBulkAction,
  type PermissionCatalogEntry,
} from "@/lib/roles/permissions-catalog";
import {
  type RolePermissionFormValues,
} from "@/lib/roles/types";

const BULK_ACTION_LABEL_KEYS: Record<
  PermissionBulkAction,
  { label: string; aria: string }
> = {
  create: {
    label: "roles.permissions.selectAllCreate",
    aria: "roles.permissions.selectAllCreateAria",
  },
  view: {
    label: "roles.permissions.selectAllView",
    aria: "roles.permissions.selectAllViewAria",
  },
  delete: {
    label: "roles.permissions.selectAllDelete",
    aria: "roles.permissions.selectAllDeleteAria",
  },
  print: {
    label: "roles.permissions.selectAllPrint",
    aria: "roles.permissions.selectAllPrintAria",
  },
};

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
  const { t } = useTranslation();
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

  const selectedEntries = useMemo(
    () => catalog.filter((entry) => assignedIds.has(entry.id) || assignedValues.has(entry.value)),
    [assignedIds, assignedValues, catalog],
  );
  const selectedGroups = useMemo(
    () => getPermissionCatalogGroups(selectedEntries),
    [selectedEntries],
  );

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
          <h3 id="permissions-heading" className="text-sm font-semibold">
            {t("roles.permissions.title")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("roles.permissions.description")}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {t("roles.permissions.selected", { count: assignedValues.size })}
        </span>
      </div>

      {catalog.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("roles.permissions.searchPlaceholder")}
            className="pl-9"
            aria-label={t("roles.permissions.searchAria")}
          />
        </div>
      ) : null}

      {!readOnly ? (
        <div className="space-y-2">
          {selectedEntries.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="bg-muted/40 px-4 py-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("roles.permissions.checkedTitle")}
                </h4>
              </div>
              <div className="max-h-56 divide-y overflow-y-auto">
                {selectedGroups.map((group) => {
                  const groupEntries = getPermissionsByGroup(group, selectedEntries);
                  return (
                    <div key={group} className="px-4 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupEntries.map((entry) => (
                          <Badge key={entry.value} variant="secondary" className="gap-1 pr-1">
                            {entry.label}
                            <button
                              type="button"
                              className="rounded-sm p-0.5 hover:bg-muted"
                              onClick={() => togglePermission(entry, false)}
                              aria-label={t("roles.permissions.removeAria", { label: entry.label })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {catalogGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={allSelected ? "secondary" : "outline"}
                aria-pressed={allSelected}
                aria-label={
                  normalizedSearch
                    ? t("roles.permissions.selectAllMatching")
                    : t("roles.permissions.selectAllAria")
                }
                onClick={() => setEntriesAssigned(filteredCatalog, !allSelected)}
              >
                {t("roles.permissions.selectAll")}
              </Button>
              {PERMISSION_BULK_ACTIONS.map((action) => {
                const entries = getPermissionsByAction(action, filteredCatalog);
                if (entries.length === 0) return null;
                const allActionSelected = entries.every((entry) => isEntryAssigned(entry));
                const keys = BULK_ACTION_LABEL_KEYS[action];
                return (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={allActionSelected ? "secondary" : "outline"}
                    aria-pressed={allActionSelected}
                    aria-label={t(keys.aria)}
                    onClick={() => setEntriesAssigned(entries, !allActionSelected)}
                  >
                    {t(keys.label)}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        {catalog.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t("roles.permissions.loading")}</p>
        ) : catalogGroups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {t("roles.permissions.noMatch", { query: search.trim() })}
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
                  aria-label={t("roles.permissions.groupSelectAllAria", { group })}
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
                        aria-label={t("roles.permissions.entryAria", { label: entry.label })}
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
