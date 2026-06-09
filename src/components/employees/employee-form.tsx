"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { formatAuditDate } from "@/lib/audit/display";
import { formatEmployeeDate, formatEmployeeMoney } from "@/lib/employees/display";
import {
  EMPLOYEE_ACTIVE_OPTIONS,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_PORTAL_BRANCHES,
  EMPLOYEE_TITLES,
  createEmployeeBranchFromPortal,
  createEmptyEmployeeForm,
  formatEmployeeUserLabel,
  getEmployeePortalBranch,
  type EmployeeAddress,
  type EmployeeFormValues,
  type EmployeePortalBranch,
} from "@/lib/employees/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const readOnlyClassName = "bg-muted/40";

type EmployeeFormProps = {
  initialValues?: EmployeeFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
  onCancel: () => void;
};

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function EmployeeForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? createEmptyEmployeeForm());

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Employee">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="id">id</Label>
            <Input
              id="id"
              value={values.id > 0 ? String(values.id) : "Assigned after save"}
              readOnly
              className={`font-mono text-xs ${readOnlyClassName}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="active">
              active <span className="text-destructive">*</span>
            </Label>
            <select
              id="active"
              className={selectClassName}
              value={values.active ? "true" : "false"}
              onChange={(event) => updateField("active", event.target.value === "true")}
              required
            >
              {EMPLOYEE_ACTIVE_OPTIONS.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="MIGUEL"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">
              department <span className="text-destructive">*</span>
            </Label>
            <select
              id="department"
              className={selectClassName}
              value={values.department}
              onChange={(event) => updateField("department", event.target.value)}
              required
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              title <span className="text-destructive">*</span>
            </Label>
            <select
              id="title"
              className={selectClassName}
              value={values.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
            >
              {titleOptions.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">startDate</Label>
            <Input
              id="startDate"
              value={values.startDate}
              onChange={(event) => updateField("startDate", event.target.value)}
              placeholder="2026-06-09T00:00:00Z"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">endDate</Label>
            <Input
              id="endDate"
              value={values.endDate}
              onChange={(event) => updateField("endDate", event.target.value)}
              placeholder="2026-06-09T00:00:00Z"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">cost</Label>
          <Input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={values.cost}
            onChange={(event) => updateField("cost", Number(event.target.value) || 0)}
          />
        </div>
      </FormSection>

      <FormSection title="branch">
        <div className="space-y-2">
          <Label htmlFor="branch-portal">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch-portal"
            className={selectClassName}
            value={selectedPortalBranch}
            onChange={(event) => updateBranchPortal(event.target.value as EmployeePortalBranch)}
            required
          >
            {EMPLOYEE_PORTAL_BRANCHES.map((option) => (
              <option key={option.portal} value={option.portal}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="branch-id">branch.id</Label>
            <Input id="branch-id" value={String(values.branch.id)} readOnly className={readOnlyClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch-code">branch.code</Label>
            <Input id="branch-code" value={values.branch.code} readOnly className={readOnlyClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branch-name">branch.name</Label>
            <Input id="branch-name" value={values.branch.name} readOnly className={readOnlyClassName} />
          </div>
        </div>
      </FormSection>

      <FormSection title="address">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-address1">address.address1</Label>
            <Input
              id="address-address1"
              value={values.address.address1}
              onChange={(event) => updateAddressField("address1", event.target.value)}
              placeholder="245 Atlantic Ave"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-address2">address.address2</Label>
            <Input
              id="address-address2"
              value={values.address.address2}
              onChange={(event) => updateAddressField("address2", event.target.value)}
              placeholder="Suite 100"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-apartment">address.apartment</Label>
            <Input
              id="address-apartment"
              value={values.address.apartment}
              onChange={(event) => updateAddressField("apartment", event.target.value)}
              placeholder="Apt 4B"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-city">address.city</Label>
            <Input
              id="address-city"
              value={values.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
              placeholder="NEW YORK"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="address-state">address.state</Label>
            <Input
              id="address-state"
              value={values.address.state}
              onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
              placeholder="NY"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-zipcode">address.zipcode</Label>
            <Input
              id="address-zipcode"
              value={values.address.zipcode}
              onChange={(event) => updateAddressField("zipcode", event.target.value)}
              placeholder="11201"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-country">address.country</Label>
            <Input
              id="address-country"
              value={values.address.country}
              onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
              placeholder="US"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone1">phone1</Label>
            <PhoneInput
              id="phone1"
              value={values.phone1}
              onChange={(nextValue) => updateField("phone1", nextValue)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">phone2</Label>
            <PhoneInput
              id="phone2"
              value={values.phone2}
              onChange={(nextValue) => updateField("phone2", nextValue)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="name@emsys.example"
          />
        </div>
      </FormSection>

      <FormSection title="Loans" description="Loan balances are managed by the EMSYS API and shown read-only here.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="loanAmountOwed">loanAmountOwed</Label>
            <Input
              id="loanAmountOwed"
              value={formatEmployeeMoney(values.loanAmountOwed)}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loanBalanceUpdated">loanBalanceUpdated</Label>
            <Input
              id="loanBalanceUpdated"
              value={values.loanBalanceUpdated ? formatEmployeeDate(values.loanBalanceUpdated) : "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalLoanGiven">totalLoanGiven</Label>
            <Input
              id="totalLoanGiven"
              value={formatEmployeeMoney(values.totalLoanGiven)}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalPaymentReceived">totalPaymentReceived</Label>
            <Input
              id="totalPaymentReceived"
              value={formatEmployeeMoney(values.totalPaymentReceived)}
              readOnly
              className={readOnlyClassName}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="user" description="Linked EMSYS user from the API.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="user">user</Label>
            <Input
              id="user"
              value={formatEmployeeUserLabel({ user: values.user })}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-id">user.id</Label>
            <Input
              id="user-id"
              value={values.user?.id ? String(values.user.id) : "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-userName">user.userName</Label>
            <Input
              id="user-userName"
              value={values.user?.userName || "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-fullName">user.fullName</Label>
            <Input
              id="user-fullName"
              value={values.user?.fullName || "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">user.email</Label>
            <Input
              id="user-email"
              value={values.user?.email || "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-active">user.active</Label>
            <Input
              id="user-active"
              value={values.user != null ? String(values.user.active) : "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
        </div>
      </FormSection>

      {isEditing ? (
        <FormSection title="Timestamps">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="createdAt">createdAt</Label>
              <Input
                id="createdAt"
                value={values.createdAt ? formatAuditDate(values.createdAt) : "—"}
                readOnly
                className={readOnlyClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="updatedAt">updatedAt</Label>
              <Input
                id="updatedAt"
                value={values.updatedAt ? formatAuditDate(values.updatedAt) : "—"}
                readOnly
                className={readOnlyClassName}
              />
            </div>
          </div>
        </FormSection>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
