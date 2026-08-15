"use client";

import { Building2, MapPin, Phone, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
import { useUsers } from "@/lib/users/hooks/use-users";
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_PORTAL_BRANCHES,
  EMPLOYEE_TITLES,
  createEmployeeBranchFromPortal,
  createEmptyEmployeeForm,
  getEmployeePortalBranch,
  type EmployeeAddress,
  type EmployeeFormValues,
  type EmployeePortalBranch,
} from "@/lib/employees/types";

type EmployeeFormProps = {
  initialValues?: EmployeeFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function EmployeeForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const { t } = useTranslation();
  const employeeLabels = useEmployeeLabels();
  const usersQuery = useUsers({ page: 1, limit: 200, sort: "name:asc", active: true });
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? createEmptyEmployeeForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyEmployeeForm());
  }, [initialValues]);

  const departmentOptions = useMemo(() => {
    const departments = Array.from(new Set([...EMPLOYEE_DEPARTMENTS, values.department].filter(Boolean)));
    return departments.map((department) => ({
      value: department,
      label: employeeLabels.department(department),
    }));
  }, [employeeLabels, values.department]);

  const titleOptions = useMemo(() => {
    const titles = Array.from(new Set([...EMPLOYEE_TITLES, values.title].filter(Boolean)));
    return titles.map((title) => ({
      value: title,
      label: employeeLabels.title(title),
    }));
  }, [employeeLabels, values.title]);

  const activeOptions = useMemo(
    () => [
      { value: "true", label: t("employees.enums.status.active") },
      { value: "false", label: t("employees.enums.status.inactive") },
    ],
    [t],
  );

  const branchOptions = useMemo(
    () =>
      EMPLOYEE_PORTAL_BRANCHES.map((option) => ({
        value: option.portal,
        label: t(`employees.enums.branch.${option.portal}`),
      })),
    [t],
  );
  const userOptions = useMemo(
    () => [
      { value: "", label: t("employees.form.fields.noUser") },
      ...(usersQuery.data?.items ?? []).map((user) => ({
        value: String(user.id),
        label: user.email ? `${user.name} · ${user.email}` : user.name,
      })),
    ],
    [t, usersQuery.data?.items],
  );

  const selectedPortalBranch = getEmployeePortalBranch({ branch: values.branch, address: values.address });

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddressField<K extends keyof EmployeeAddress>(key: K, value: EmployeeAddress[K]) {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function updateBranchPortal(portal: EmployeePortalBranch) {
    const template = createEmployeeBranchFromPortal(portal);
    const config = EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? EMPLOYEE_PORTAL_BRANCHES[0];

    setValues((current) => ({
      ...current,
      branch: template,
      address: {
        ...current.address,
        country: config.country,
      },
    }));
  }

  function updateUser(userId: string) {
    const user = (usersQuery.data?.items ?? []).find((entry) => String(entry.id) === userId);
    updateField("user", user ? { ...user } : null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={User} title={t("employees.form.sections.employee")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="active">
                {t("employees.form.fields.active")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="active"
                value={values.active ? "true" : "false"}
                onValueChange={(next) => updateField("active", next === "true")}
                required
                options={activeOptions}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                {t("employees.form.fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder={t("employees.form.placeholders.name")}
                required
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="department">
                  {t("employees.form.fields.department")} <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="department"
                  value={values.department}
                  onValueChange={(next) => updateField("department", next)}
                  searchPlaceholder={t("employees.form.placeholders.departmentSearch")}
                  required
                  options={departmentOptions}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="title">
                  {t("employees.form.fields.title")} <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="title"
                  value={values.title}
                  onValueChange={(next) => updateField("title", next)}
                  searchPlaceholder={t("employees.form.placeholders.titleSearch")}
                  required
                  options={titleOptions}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="startDate">{t("employees.form.fields.startDate")}</Label>
                <Input
                  id="startDate"
                  value={values.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                  placeholder={t("employees.form.placeholders.startDate")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="endDate">{t("employees.form.fields.endDate")}</Label>
                <Input
                  id="endDate"
                  value={values.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                  placeholder={t("employees.form.placeholders.endDate")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cost">{t("employees.form.fields.cost")}</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={values.cost}
                onChange={(event) => updateField("cost", Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="userId">{t("employees.form.fields.user")}</Label>
              <SearchableSelect
                id="userId"
                value={values.user ? String(values.user.id) : ""}
                onValueChange={updateUser}
                placeholder={t("employees.form.fields.noUser")}
                searchPlaceholder={t("employees.form.placeholders.userSearch")}
                options={userOptions}
                disabled={usersQuery.isLoading}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Building2} title={t("employees.form.sections.branch")}>
          <div className="space-y-1">
            <Label htmlFor="branch-portal">
              {t("employees.form.fields.branch")} <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="branch-portal"
              value={selectedPortalBranch}
              onValueChange={(next) => updateBranchPortal(next as EmployeePortalBranch)}
              searchPlaceholder={t("employees.form.placeholders.branchSearch")}
              required
              options={branchOptions}
            />
          </div>
        </FormSection>

        <FormSection icon={MapPin} title={t("employees.form.sections.address")}>
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="address-address1">{t("employees.form.fields.address1")}</Label>
                <Input
                  id="address-address1"
                  value={values.address.address1}
                  onChange={(event) => updateAddressField("address1", event.target.value)}
                  placeholder={t("employees.form.placeholders.address1")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-address2">{t("employees.form.fields.address2")}</Label>
                <Input
                  id="address-address2"
                  value={values.address.address2}
                  onChange={(event) => updateAddressField("address2", event.target.value)}
                  placeholder={t("employees.form.placeholders.address2")}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="address-apartment">{t("employees.form.fields.apartment")}</Label>
                <Input
                  id="address-apartment"
                  value={values.address.apartment}
                  onChange={(event) => updateAddressField("apartment", event.target.value)}
                  placeholder={t("employees.form.placeholders.apartment")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-city">{t("employees.form.fields.city")}</Label>
                <Input
                  id="address-city"
                  value={values.address.city}
                  onChange={(event) => updateAddressField("city", event.target.value)}
                  placeholder={t("employees.form.placeholders.city")}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="address-state">{t("employees.form.fields.state")}</Label>
                <Input
                  id="address-state"
                  value={values.address.state}
                  onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                  placeholder={t("employees.form.placeholders.state")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-zipcode">{t("employees.form.fields.zipcode")}</Label>
                <Input
                  id="address-zipcode"
                  value={values.address.zipcode}
                  onChange={(event) => updateAddressField("zipcode", event.target.value)}
                  placeholder={t("employees.form.placeholders.zipcode")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-country">{t("employees.form.fields.country")}</Label>
                <Input
                  id="address-country"
                  value={values.address.country}
                  onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
                  placeholder={t("employees.form.placeholders.country")}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Phone} title={t("employees.form.sections.contact")}>
          <div className="space-y-2.5">
            <PhoneListEditor
              idPrefix="employee-phone"
              phones={values.phones}
              onChange={(phones) => updateField("phones", phones)}
            />

            <div className="space-y-1">
              <Label htmlFor="email">{t("employees.form.fields.email")}</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder={t("employees.form.placeholders.email")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
