"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cloneEmployeeGroups } from "@/lib/employee-groups/mock-data";
import {
  formatEmployeeGroupRefName,
  formatRouteAssignmentCopyLabel,
} from "@/lib/route-assignments/display";
import {
  copyRouteAssignmentFormValues,
  createEmptyRouteAssignmentForm,
  type RouteAssignment,
  type RouteAssignmentFormValues,
} from "@/lib/route-assignments/types";
import { useTruckPicker } from "@/lib/trucks/hooks/use-trucks";
import { getBranchLabel } from "@/lib/trucks/display";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const readOnlyClassName = "bg-muted/40";

type RouteAssignmentFormProps = {
  initialValues?: RouteAssignmentFormValues;
  copySources?: RouteAssignment[];
  isEditing?: boolean;
  submitLabel: string;
  onSubmit: (values: RouteAssignmentFormValues) => void;
  onCancel: () => void;
};

export function RouteAssignmentForm({
  initialValues,
  copySources = [],
  isEditing = false,
  submitLabel,
  onSubmit,
  onCancel,
}: RouteAssignmentFormProps) {
  const { data: trucksData } = useTruckPicker();
  const trucks = trucksData?.items ?? [];
  const employeeGroups = useMemo(() => cloneEmployeeGroups(), []);
  const [values, setValues] = useState<RouteAssignmentFormValues>(
    initialValues ?? createEmptyRouteAssignmentForm(),
  );
  const [copyFromId, setCopyFromId] = useState("");

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteAssignmentForm());
    setCopyFromId("");
  }, [initialValues]);

  function updateField<K extends keyof RouteAssignmentFormValues>(key: K, value: RouteAssignmentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleTruckChange(truckRecordId: string) {
    const truck = trucks.find((entry) => entry.id === truckRecordId);
    updateField("truck", {
      id: truckRecordId,
      name: truck?.name ?? "",
    });
  }

  function handleEmployeeGroupChange(groupId: string) {
    const group = employeeGroups.find((entry) => entry.employeeGroupId === groupId);
    updateField("employeeGroup", {
      id: groupId,
      name: group ? formatEmployeeGroupRefName(group) : "",
    });
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
          <Label htmlFor="id">Assignment ID</Label>
          <Input
            id="id"
            value={values.id || "Assigned after save"}
            readOnly
            className={`font-mono text-xs ${readOnlyClassName}`}
          />
          {!isEditing ? (
            <p className="text-xs text-muted-foreground">The EMSYS API assigns the record id on create.</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="routeAssignmentId">
            routeAssignmentId <span className="text-destructive">*</span>
          </Label>
          <Input
            id="routeAssignmentId"
            value={values.routeAssignmentId}
            onChange={(event) => updateField("routeAssignmentId", event.target.value)}
            placeholder="ras-001"
            className="font-mono text-xs"
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">
            name <span className="text-destructive">*</span>
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
            date <span className="text-destructive">*</span>
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
            truck.id <span className="text-destructive">*</span>
          </Label>
          <select
            id="truckId"
            className={selectClassName}
            value={values.truck.id}
            onChange={(event) => handleTruckChange(event.target.value)}
            required
          >
            <option value="">Select a truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.name} · {getBranchLabel(truck.branch)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="truckName">truck.name</Label>
          <Input
            id="truckName"
            value={values.truck.name}
            readOnly
            className={readOnlyClassName}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeGroupId">
            employeeGroup.id <span className="text-destructive">*</span>
          </Label>
          <select
            id="employeeGroupId"
            className={selectClassName}
            value={values.employeeGroup.id}
            onChange={(event) => handleEmployeeGroupChange(event.target.value)}
            required
          >
            <option value="">Select an employee group</option>
            {employeeGroups.map((group) => (
              <option key={group.employeeGroupId} value={group.employeeGroupId}>
                {formatEmployeeGroupRefName(group)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeGroupName">employeeGroup.name</Label>
          <Input
            id="employeeGroupName"
            value={values.employeeGroup.name}
            readOnly
            className={readOnlyClassName}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
