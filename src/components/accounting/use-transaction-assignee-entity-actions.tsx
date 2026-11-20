"use client";

import { useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { EmployeeForm } from "@/components/employees/employee-form";
import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import {
  CompactActionDialogContent,
  CompactActionDialogHeader,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Route, UserPlus } from "lucide-react";
import {
  resolveDailyRouteSupervisor,
} from "@/lib/accounting/daily-income/assignee";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
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
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type EntityDialog = "employee" | "route" | null;

type Options = {
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  employees: Employee[];
  dailyRoutes: ActiveRoute[];
  statementDate?: string;
  employeeId?: number;
  routeId?: string;
};

function clearRouteFields(setValue: UseFormSetValue<DailyIncomeJournalValues>) {
  setValue("routeId", undefined, { shouldValidate: true });
  setValue("routeName", "");
  setValue("routeCrewId", undefined, { shouldValidate: true });
  setValue("routeCrewName", "");
  setValue("supervisorId", undefined, { shouldValidate: true });
  setValue("supervisorName", "");
}

function clearEmployeeFields(setValue: UseFormSetValue<DailyIncomeJournalValues>) {
  setValue("employeeId", undefined, { shouldValidate: true });
  setValue("employeeName", "");
  setValue("employeeGroupId", undefined, { shouldValidate: true });
  setValue("employeeGroupName", "");
}

/** New/Edit employee and daily-route actions for transaction assignee pickers. */
export function useTransactionAssigneeEntityActions({
  setValue,
  employees,
  dailyRoutes,
  statementDate,
  employeeId,
  routeId,
}: Options) {
  const { t } = useTranslation();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const ensureEmployeeDetail = useEnsureEmployeeDetail();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRoute, setEditingRoute] = useState<ActiveRoute | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  const selectedEmployee =
    (employeeId ? employees.find((employee) => employee.id === employeeId) : undefined) ?? editingEmployee;
  const selectedRoute =
    (routeId ? dailyRoutes.find((route) => route.id === routeId) : undefined) ?? editingRoute;

  function applyEmployee(employee: Employee) {
    setValue("assigneeSource", "employee", { shouldValidate: true });
    setValue("employeeId", employee.id, { shouldValidate: true });
    setValue("employeeName", employee.name);
    setValue("employeeGroupId", undefined, { shouldValidate: true });
    setValue("employeeGroupName", "");
    clearRouteFields(setValue);
  }

  function applyRoute(route: ActiveRoute) {
    const employeeNames =
      route.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") || "";
    setValue("assigneeSource", "route", { shouldValidate: true });
    setValue("routeId", route.id, { shouldValidate: true });
    setValue("routeName", route.name.trim() || employeeNames || route.id);
    setValue("routeCrewId", undefined, { shouldValidate: true });
    setValue("routeCrewName", "");
    const supervisor = resolveDailyRouteSupervisor(route);
    setValue("supervisorId", supervisor?.id, { shouldValidate: true });
    setValue("supervisorName", supervisor?.name ?? "");
    clearEmployeeFields(setValue);
  }

  const { markPendingAdd } = useApplyCreatedOnTabReturn((feature, id) => {
    if (feature !== "employees") return;
    void ensureEmployeeDetail(id)
      .then(applyEmployee)
      .catch(() => setEntityError(t("invoices.form.validation.createdEmployeeLoadFailed")));
  });

  function openAddEmployee() {
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
    setEditingEmployee(null);
    setEntityError(null);
    setEntityDialog("employee");
  }

  function openEditEmployee() {
    if (!selectedEmployee) return;
    setEditingEmployee(selectedEmployee);
    setEntityError(null);
    setEntityDialog("employee");
  }

  function openAddRoute() {
    setEditingRoute(null);
    setEntityError(null);
    setEntityDialog("route");
  }

  function openEditRoute() {
    if (!selectedRoute) return;
    setEditingRoute(selectedRoute);
    setEntityError(null);
    setEntityDialog("route");
  }

  async function saveEmployee(values: EmployeeFormValues) {
    try {
      setEntityError(null);
      const saved = editingEmployee
        ? await updateEmployee.mutateAsync({
            employeeId: String(editingEmployee.id),
            values,
          })
        : await createEmployee.mutateAsync(values);
      applyEmployee(saved);
      setEntityDialog(null);
      setEditingEmployee(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  function selectRoute(route?: ActiveRoute) {
    if (route) applyRoute(route);
    setEntityDialog(null);
    setEditingRoute(null);
  }

  const entityDialogs = (
    <>
      <Dialog open={entityDialog === "employee"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-2xl", "z-[70]")}>
          <CompactActionDialogHeader
            icon={UserPlus}
            title={editingEmployee ? t("employees.form.editTitle") : t("employees.form.addTitle")}
          />
          <EmployeeForm
            key={editingEmployee ? String(editingEmployee.id) : "new-employee"}
            initialValues={
              editingEmployee ? employeeToFormValues(editingEmployee) : createEmptyEmployeeForm()
            }
            isEditing={Boolean(editingEmployee)}
            submitLabel={
              editingEmployee ? t("common.actions.saveChanges") : t("employees.actions.add")
            }
            isSubmitting={createEmployee.isPending || updateEmployee.isPending}
            externalError={entityError}
            binaryControl="buttons"
            onSubmit={saveEmployee}
            onCancel={() => setEntityDialog(null)}
          />
        </CompactActionDialogContent>
      </Dialog>

      <Dialog open={entityDialog === "route"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-3xl", "z-[70]")}>
          <CompactActionDialogHeader
            icon={Route}
            title={
              editingRoute
                ? t("routes.dailyRoutes.editTitle")
                : t("routes.dailyRoutes.addTabLabel")
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActiveRouteSection
              key={editingRoute?.id ?? "new-route"}
              initialRecord={editingRoute}
              variant={DAILY_ROUTES_DIRECTORY_VARIANT}
              defaultDate={statementDate}
              onSaved={selectRoute}
              onCancel={() => setEntityDialog(null)}
            />
          </div>
        </CompactActionDialogContent>
      </Dialog>
    </>
  );

  return {
    onAddEmployee: openAddEmployee,
    onEditEmployee: openEditEmployee,
    onAddRoute: openAddRoute,
    onEditRoute: openEditRoute,
    entityDialogs,
  };
}
