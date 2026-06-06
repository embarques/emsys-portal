"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { cloneEmployeeGroups } from "@/lib/employee-groups/mock-data";
import { getEmployeeGroupBranchLabel } from "@/lib/employee-groups/display";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import {
  copyRouteAssignmentFormValues,
  createEmptyRouteAssignmentForm,
  type RouteAssignment,
  type RouteAssignmentFormValues,
} from "@/lib/route-assignments/types";
import { cloneTrucks } from "@/lib/trucks/mock-data";
import { getBranchLabel } from "@/lib/trucks/display";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type RouteAssignmentFormProps = {
  initialValues?: RouteAssignmentFormValues;
  copySources?: RouteAssignment[];
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: RouteAssignmentFormValues) => void;
  onCancel: () => void;
};

export function RouteAssignmentForm({
  initialValues,
  copySources = [],
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: RouteAssignmentFormProps) {
  const trucks = useMemo(() => cloneTrucks(), []);
  const employeeGroups = useMemo(() => cloneEmployeeGroups(), []);
  const [values, setValues] = useState<RouteAssignmentFormValues>(
    initialValues ?? createEmptyRouteAssignmentForm()
  );
  const [copyFromId, setCopyFromId] = useState("");

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteAssignmentForm());
    setCopyFromId("");
  }, [initialValues]);

  function updateField<K extends keyof RouteAssignmentFormValues>(key: K, value: RouteAssignmentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleCopyFrom(sourceId: string) {
    setCopyFromId(sourceId);
    if (!sourceId) return;

    const source = copySources.find((assignment) => assignment.routeAssignmentId === sourceId);
    if (!source) return;

    setValues(copyRouteAssignmentFormValues(source, values.createdBy));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isEditing && copySources.length > 0 ? (
        <section className="rounded-xl border border-dashed bg-muted/10 p-4">
          <div className="flex items-start gap-3">
            <Copy className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <div>
                <Label htmlFor="copyFrom">Copy from existing assignment</Label>
                <p className="text-xs text-muted-foreground">
                  Prefill truck and employee group from a previous assignment with today&apos;s date.
                </p>
              </div>
              <select
                id="copyFrom"
                className={selectClassName}
                value={copyFromId}
                onChange={(event) => handleCopyFrom(event.target.value)}
              >
                <option value="">Start from scratch</option>
                {copySources.map((assignment) => (
                  <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                    {formatRouteAssignmentCopyLabel(assignment)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="routeAssignmentId">Route assignment ID</Label>
          <Input
            id="routeAssignmentId"
            value={values.routeAssignmentId}
            readOnly
            className="bg-muted/40 font-mono text-xs"
          />
          {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new assignments.</p> : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">
            Route assignment name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Brooklyn morning run"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">
            Assignment date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="truckId">
            Truck <span className="text-destructive">*</span>
          </Label>
          <select
            id="truckId"
            className={selectClassName}
            value={values.truckId}
            onChange={(event) => updateField("truckId", event.target.value)}
            required
          >
            <option value="">Select a truck</option>
            {trucks.map((truck) => (
              <option key={truck.truckId} value={truck.truckId}>
                {truck.name} · {getBranchLabel(truck.branch)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeGroupId">
            Employee group <span className="text-destructive">*</span>
          </Label>
          <select
            id="employeeGroupId"
            className={selectClassName}
            value={values.employeeGroupId}
            onChange={(event) => updateField("employeeGroupId", event.target.value)}
            required
          >
            <option value="">Select an employee group</option>
            {employeeGroups.map((group) => (
              <option key={group.employeeGroupId} value={group.employeeGroupId}>
                {group.employeeGroupId} · {getEmployeeGroupBranchLabel(group.branch)} · {group.employeeIds.length}{" "}
                employees
              </option>
            ))}
          </select>
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
