"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CircleCheck, ClipboardList, Users } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { createEmptyRouteForm, type RouteFormValues } from "@/lib/route-manager/types";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  buildFormBranchOptions,
  findBranchByCodeOrId,
  resolveUserBranchRef,
  type BranchRef,
} from "@/lib/branches/user-branch";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

const EMPTY_BRANCHES: BranchRef[] = [];

type RouteFormProps = {
  initialValues?: RouteFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: RouteFormValues) => void;
  onCancel: () => void;
};

export function RouteForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<RouteFormValues>(
    initialValues ?? createEmptyRouteForm(),
  );
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const branchCode = values.branch.code.trim();
  const branchesQuery = useBranchPicker(200);
  const branches = branchesQuery.data?.items ?? EMPTY_BRANCHES;
  const currentUserQuery = useCurrentUser();
  const handleEnterNavigation = useFormEnterNavigation();

  // Only sync external values when editing — add mode owns its own state.
  useEffect(() => {
    if (!isEditing || !initialValues) return;
    setValues(initialValues);
    setEmployeeError(null);
  }, [initialValues, isEditing]);

  // Keep branch id/name in sync with the branch directory (API requires both on save).
  useEffect(() => {
    if (!branchCode || branches.length === 0) return;

    const match = findBranchByCodeOrId(branches, {
      id: values.branch.id,
      code: values.branch.code,
      name: values.branch.name,
    });
    if (!match) return;

    setValues((current) => {
      const name = match.name?.trim() ?? "";
      if (
        current.branch.id === match.id &&
        current.branch.code === match.code &&
        current.branch.name?.trim() === name
      ) {
        return current;
      }

      return {
        ...current,
        branch: { id: match.id, code: match.code, name },
      };
    });
  }, [branches, branchCode, values.branch.id, values.branch.code, values.branch.name]);

  useEffect(() => {
    // Wait until the branch catalog can resolve a real code to avoid update loops.
    const resolved = resolveUserBranchRef(currentUserQuery.data?.branch, branches);
    if (!resolved?.code.trim()) return;

    setValues((current) => {
      if (current.branch.id > 0 && current.branch.code.trim()) return current;
      if (
        current.branch.id === resolved.id &&
        current.branch.code === resolved.code &&
        (current.branch.name?.trim() ?? "") === resolved.name
      ) {
        return current;
      }
      return { ...current, branch: resolved };
    });
  }, [branches, currentUserQuery.data?.branch]);

  function updateField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleBranchChange(nextBranchCode: string) {
    const normalized = nextBranchCode.trim().toLowerCase();
    const branch = branches.find((entry) => entry.code.trim().toLowerCase() === normalized);
    setValues((current) => ({
      ...current,
      branch: {
        id: branch?.id ?? 0,
        code: branch?.code ?? nextBranchCode,
        name: branch?.name ?? "",
      },
      employees: [],
    }));
    setEmployeeError(null);
  }

  function handleEmployeesChange(employees: RouteFormValues["employees"]) {
    setEmployeeError(null);
    updateField("employees", employees);
  }

  const branchOptions = useMemo(
    () => buildFormBranchOptions(branches, values.branch.code.trim() ? values.branch : null),
    [branches, values.branch],
  );
  const selectBranchCode =
    findBranchByCodeOrId(branches, values.branch)?.code || values.branch.code;

  const hasBranch = values.branch.id > 0 && Boolean(values.branch.name?.trim());

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasBranch) {
      setEmployeeError(t("routes.form.validation.branchRequired"));
      return;
    }
    if (values.employees.length === 0) {
      setEmployeeError(t("routes.form.crewMemberRequired"));
      return;
    }
    setEmployeeError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        {isEditing && (values.routeId.trim() || values.name.trim()) ? (
          <FormSection icon={ClipboardList} title={t("routes.form.sections.details")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {values.routeId.trim() ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="route-display-id">{t("routes.routeDetails.routeId")}</Label>
                  <p id="route-display-id" className="font-mono text-sm">
                    {values.routeId}
                  </p>
                </div>
              ) : null}

              {values.name.trim() ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="route-display-name">{t("routes.routeDetails.name")}</Label>
                  <p id="route-display-name" className="text-sm font-medium">
                    {values.name}
                  </p>
                </div>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        <FormSection icon={CircleCheck} title={t("routes.activeRoute.status")}>
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-input bg-muted p-1"
            role="radiogroup"
            aria-label={t("routes.activeRoute.status")}
          >
            {[
              { value: true, label: t("routes.activeRoute.active") },
              { value: false, label: t("routes.activeRoute.inactive") },
            ].map((option) => {
              const selected = values.active === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateField("active", option.value)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected && option.value
                      ? "bg-emerald-600 text-white shadow-sm"
                      : selected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection icon={Building2} title={t("routes.form.sections.branch")} required>
          <SearchableSelect
            id="routeBranch"
            aria-label={t("routes.form.sections.branch")}
            value={selectBranchCode}
            onValueChange={handleBranchChange}
            placeholder={t("routes.form.branchPlaceholder")}
            searchPlaceholder={t("routes.form.branchSearch")}
            loading={branchesQuery.isLoading}
            required
            options={branchOptions}
          />
        </FormSection>

        <FormSection icon={Users} title={t("routes.form.sections.crew")} required>
          {hasBranch ? (
            <RouteEmployeeSelect
              value={values.employees}
              onChange={handleEmployeesChange}
              error={employeeError}
              branchCode={values.branch.code}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("routes.form.selectBranchFirst")}</p>
          )}
        </FormSection>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={externalError}
        submitDisabled={!hasBranch || values.employees.length === 0}
        onCancel={onCancel}
      />
    </form>
  );
}
