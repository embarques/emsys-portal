"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
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
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";
import { getBranchLabel } from "@/lib/vehicles/display";

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
  const { data: vehiclesData } = useVehiclePicker();
  const vehicles = vehiclesData?.items ?? [];
  const employeeGroups = useMemo(() => cloneEmployeeGroups(), []);
  const [values, setValues] = useState<RouteAssignmentFormValues>(
    initialValues ?? createEmptyRouteAssignmentForm(),
  );
  const [copyFromId, setCopyFromId] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteAssignmentForm());
    setCopyFromId("");
  }, [initialValues]);

  function updateField<K extends keyof RouteAssignmentFormValues>(key: K, value: RouteAssignmentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleVehicleChange(vehicleRecordId: string) {
    const vehicle = vehicles.find((entry) => entry.id === vehicleRecordId);
    updateField("truck", {
      id: vehicleRecordId,
      name: vehicle?.name ?? "",
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
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
      {!isEditing && copySources.length > 0 ? (
        <section className="rounded-xl border border-dashed bg-muted/10 p-4">
          <div className="flex items-start gap-3">
            <Copy className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <div>
                <Label htmlFor="copyFrom">Copy from existing assignment</Label>
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
          <Label htmlFor="routeAssignmentId">
            Assignment number <span className="text-destructive">*</span>
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
            Name <span className="text-destructive">*</span>
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
            Date <span className="text-destructive">*</span>
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
          <Label htmlFor="vehicleId">
            Vehicle <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="vehicleId"
            value={values.truck.id}
            onValueChange={handleVehicleChange}
            placeholder="Select a vehicle"
            searchPlaceholder="Search vehicles…"
            required
            options={[
              { value: "", label: "Select a vehicle" },
              ...vehicles.map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.name} · ${getBranchLabel(vehicle.branch)}`,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeGroupId">
            Employee group <span className="text-destructive">*</span>
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

      </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
