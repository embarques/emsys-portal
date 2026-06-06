"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import {
  EMPLOYEE_BRANCHES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUSES,
  createEmptyEmployeeForm,
  type EmployeeFormValues,
} from "@/lib/employees/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type EmployeeFormProps = {
  initialValues?: EmployeeFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
};

export function EmployeeForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? createEmptyEmployeeForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyEmployeeForm());
  }, [initialValues]);

  function updateField<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="employeeId">Employee ID</Label>
        <Input id="employeeId" value={values.employeeId} readOnly className="bg-muted/40 font-mono text-xs" />
        {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new employees.</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Carlos Ramírez"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) => updateField("branch", event.target.value as EmployeeFormValues["branch"])}
            required
          >
            {EMPLOYEE_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">
            Status <span className="text-destructive">*</span>
          </Label>
          <select
            id="status"
            className={selectClassName}
            value={values.status}
            onChange={(event) => updateField("status", event.target.value as EmployeeFormValues["status"])}
            required
          >
            {EMPLOYEE_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="department">
            Department <span className="text-destructive">*</span>
          </Label>
          <select
            id="department"
            className={selectClassName}
            value={values.department}
            onChange={(event) => updateField("department", event.target.value)}
            required
          >
            {EMPLOYEE_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">
            Role <span className="text-destructive">*</span>
          </Label>
          <select
            id="role"
            className={selectClassName}
            value={values.role}
            onChange={(event) => updateField("role", event.target.value)}
            required
          >
            {EMPLOYEE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={values.address}
          onChange={(event) => updateField("address", event.target.value)}
          placeholder="245 Atlantic Ave"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={values.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Brooklyn"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={values.state}
            onChange={(event) => updateField("state", event.target.value.toUpperCase())}
            placeholder="NY"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="zip">Zip</Label>
          <Input
            id="zip"
            value={values.zip}
            onChange={(event) => updateField("zip", event.target.value)}
            placeholder="11201"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="+1 (718) 555-0142"
          />
        </div>

        <div className="space-y-2">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">
            Date started working <span className="text-destructive">*</span>
          </Label>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(event) => updateField("startDate", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">
            Date ended working
            {values.status === "inactive" ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id="endDate"
            type="date"
            value={values.endDate}
            onChange={(event) => updateField("endDate", event.target.value)}
            required={values.status === "inactive"}
          />
          {values.status === "inactive" ? (
            <p className="text-xs text-muted-foreground">Required when status is inactive.</p>
          ) : null}
        </div>
      </div>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
