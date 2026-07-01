"use client";

import { Building2, MapPin, Phone, User } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  EMPLOYEE_ACTIVE_OPTIONS,
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
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? createEmptyEmployeeForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyEmployeeForm());
  }, [initialValues]);

  const departmentOptions = Array.from(
    new Set([...EMPLOYEE_DEPARTMENTS, values.department].filter(Boolean)),
  );
  const titleOptions = Array.from(new Set([...EMPLOYEE_TITLES, values.title].filter(Boolean)));
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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={User} title="Employee">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="active">
                Active <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="active"
                value={values.active ? "true" : "false"}
                onValueChange={(next) => updateField("active", next === "true")}
                required
                options={EMPLOYEE_ACTIVE_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="MIGUEL"
                required
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="department"
                  value={values.department}
                  onValueChange={(next) => updateField("department", next)}
                  searchPlaceholder="Search departments…"
                  required
                  options={departmentOptions.map((department) => ({ value: department, label: department }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="title"
                  value={values.title}
                  onValueChange={(next) => updateField("title", next)}
                  searchPlaceholder="Search titles…"
                  required
                  options={titleOptions.map((title) => ({ value: title, label: title }))}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  value={values.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                  placeholder="2026-06-09T00:00:00Z"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  value={values.endDate}
                  onChange={(event) => updateField("endDate", event.target.value)}
                  placeholder="2026-06-09T00:00:00Z"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={values.cost}
                onChange={(event) => updateField("cost", Number(event.target.value) || 0)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Building2} title="Branch">
          <div className="space-y-1">
            <Label htmlFor="branch-portal">
              Branch <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="branch-portal"
              value={selectedPortalBranch}
              onValueChange={(next) => updateBranchPortal(next as EmployeePortalBranch)}
              searchPlaceholder="Search branches…"
              required
              options={EMPLOYEE_PORTAL_BRANCHES.map((option) => ({
                value: option.portal,
                label: option.label,
              }))}
            />
          </div>
        </FormSection>

        <FormSection icon={MapPin} title="Address">
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="address-address1">Address line 1</Label>
                <Input
                  id="address-address1"
                  value={values.address.address1}
                  onChange={(event) => updateAddressField("address1", event.target.value)}
                  placeholder="245 Atlantic Ave"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-address2">Address line 2</Label>
                <Input
                  id="address-address2"
                  value={values.address.address2}
                  onChange={(event) => updateAddressField("address2", event.target.value)}
                  placeholder="Suite 100"
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="address-apartment">Apartment / suite</Label>
                <Input
                  id="address-apartment"
                  value={values.address.apartment}
                  onChange={(event) => updateAddressField("apartment", event.target.value)}
                  placeholder="Apt 4B"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-city">City</Label>
                <Input
                  id="address-city"
                  value={values.address.city}
                  onChange={(event) => updateAddressField("city", event.target.value)}
                  placeholder="NEW YORK"
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="address-state">State / province</Label>
                <Input
                  id="address-state"
                  value={values.address.state}
                  onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                  placeholder="NY"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-zipcode">Zip / postal code</Label>
                <Input
                  id="address-zipcode"
                  value={values.address.zipcode}
                  onChange={(event) => updateAddressField("zipcode", event.target.value)}
                  placeholder="11201"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-country">Country</Label>
                <Input
                  id="address-country"
                  value={values.address.country}
                  onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
                  placeholder="US"
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Phone} title="Contact">
          <div className="space-y-2.5">
            <PhoneListEditor
              idPrefix="employee-phone"
              phones={values.phones}
              onChange={(phones) => updateField("phones", phones)}
            />

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@emsys.example"
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
