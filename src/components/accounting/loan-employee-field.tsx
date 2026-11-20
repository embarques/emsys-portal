"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FieldLabelRow } from "@/components/forms/field-label-row";
import {
  CompactActionDialogContent,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateEmployee,
  useEnsureEmployeeDetail,
  useUpdateEmployee,
} from "@/lib/employees/hooks/use-employees";
import {
  createEmptyEmployeeForm,
  employeeToFormValues,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";
import { useApplyCreatedOnTabReturn } from "@/lib/layout/hooks/use-apply-created-on-tab-return";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

type Props = {
  id: string;
  label: string;
  employees: Array<{ id: number; name: string }>;
  value?: number;
  valueName?: string;
  error?: string;
  guided?: boolean;
  required?: boolean;
  onChange: (employee: { id: number; name: string } | null) => void;
  placeholder: string;
  searchPlaceholder: string;
};

export function LoanEmployeeField({
  id,
  label,
  employees,
  value,
  valueName,
  error,
  guided = false,
  required = true,
  onChange,
  placeholder,
  searchPlaceholder,
}: Props) {
  const { t } = useTranslation();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const ensureEmployeeDetail = useEnsureEmployeeDetail();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: employee.name,
        keywords: [employee.name],
      })),
    [employees],
  );

  const { markPendingAdd } = useApplyCreatedOnTabReturn((feature, createdId) => {
    if (feature !== "employees") return;
    void ensureEmployeeDetail(createdId)
      .then((employee) => onChange({ id: employee.id, name: employee.name }))
      .catch(() => setEntityError(t("invoices.form.validation.createdEmployeeLoadFailed")));
  });

  function openAdd() {
    if (isDesktopTabs) {
      markPendingAdd("employees");
      openFormTab({
        feature: "employees",
        baseHref: "/employees",
        mode: "add",
        label: t("employees.actions.add"),
        closeOnSave: true,
      });
      return;
    }
    setEditing(null);
    setEntityError(null);
    setDialogOpen(true);
  }

  function openEdit() {
    if (!value) return;
    void ensureEmployeeDetail(String(value))
      .then((employee) => {
        setEditing(employee);
        setEntityError(null);
        setDialogOpen(true);
      })
      .catch(() => setEntityError(t("invoices.form.validation.createdEmployeeLoadFailed")));
  }

  async function saveEmployee(values: EmployeeFormValues) {
    try {
      setEntityError(null);
      const saved = editing
        ? await updateEmployee.mutateAsync({ employeeId: String(editing.id), values })
        : await createEmployee.mutateAsync(values);
      onChange({ id: saved.id, name: saved.name });
      setDialogOpen(false);
      setEditing(null);
    } catch (saveError) {
      setEntityError(normalizeApiError(saveError).message);
    }
  }

  const inlineOptionsLimit = guided ? QUICK_SELECT_OPTIONS_LIMIT : undefined;
  const isInline = getInlineSelectOptions({ inlineOptionsLimit, options, value: value ? String(value) : "", placeholder }) !== null;

  return (
    <div className="space-y-2">
      <FieldLabelRow
        showClear={Boolean(value) && isInline}
        onClear={() => {
          onChange(null);
          window.requestAnimationFrame(() => document.getElementById(id)?.focus());
        }}
        actions={
          <FieldEntityActions
            hasSelection={Boolean(value)}
            onAdd={openAdd}
            onEdit={openEdit}
            addIcon={UserPlus}
          />
        }
      >
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      </FieldLabelRow>
      <SearchableSelect
        inlineOptionsLimit={inlineOptionsLimit}
        clearable={false}
        required={required}
        id={id}
        aria-label={label}
        aria-invalid={Boolean(error)}
        value={value ? String(value) : ""}
        onValueChange={(next) => {
          if (!next) {
            onChange(null);
            return;
          }
          const employee = employees.find((item) => item.id === Number(next));
          onChange({
            id: employee?.id ?? Number(next),
            name: employee?.name ?? valueName ?? "",
          });
        }}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        mobileSheet
      />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {entityError && !dialogOpen ? (
        <p role="alert" className="text-sm text-destructive">{entityError}</p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-2xl", "z-[70]")}>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("employees.form.editTitle") : t("employees.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          {dialogOpen ? (
            <EmployeeForm
              key={editing ? String(editing.id) : "new-loan-employee"}
              initialValues={editing ? employeeToFormValues(editing) : createEmptyEmployeeForm()}
              isEditing={Boolean(editing)}
              submitLabel={editing ? t("common.actions.saveChanges") : t("employees.actions.add")}
              isSubmitting={createEmployee.isPending || updateEmployee.isPending}
              externalError={entityError}
              binaryControl="buttons"
              onSubmit={saveEmployee}
              onCancel={() => setDialogOpen(false)}
            />
          ) : null}
        </CompactActionDialogContent>
      </Dialog>
    </div>
  );
}
