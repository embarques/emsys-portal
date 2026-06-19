"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
              <SearchableSelect
                id="copyFrom"
                value={copyFromId}
                onValueChange={handleCopyFrom}
                placeholder="Start from scratch"
                searchPlaceholder="Search assignments…"
                options={[
                  { value: "", label: "Start from scratch" },
                  ...copySources.map((assignment) => ({
                    value: assignment.routeAssignmentId,
                    label: formatRouteAssignmentCopyLabel(assignment),
                  })),
                ]}
              />
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
          <SearchableSelect
            id="truckId"
            value={values.truck.id}
            onValueChange={handleTruckChange}
            placeholder="Select a truck"
            searchPlaceholder="Search trucks…"
            required
            options={[
              { value: "", label: "Select a truck" },
              ...trucks.map((truck) => ({
                value: truck.id,
                label: `${truck.name} · ${getBranchLabel(truck.branch)}`,
              })),
            ]}
          />
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
          <SearchableSelect
            id="employeeGroupId"
            value={values.employeeGroup.id}
            onValueChange={handleEmployeeGroupChange}
            placeholder="Select an employee group"
            searchPlaceholder="Search employee groups…"
            required
            options={[
              { value: "", label: "Select an employee group" },
              ...employeeGroups.map((group) => ({
                value: group.employeeGroupId,
                label: formatEmployeeGroupRefName(group),
              })),
            ]}
          />
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
