"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cloneEmployeeGroups } from "@/lib/employee-groups/mock-data";
import {
  buildDefaultRouteAssignmentName,
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
  const [nameEdited, setNameEdited] = useState(isEditing);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteAssignmentForm());
    setCopyFromId("");
    setNameEdited(isEditing);
  }, [initialValues, isEditing]);

  const defaultName = useMemo(() => {
    const selectedGroup = employeeGroups.find(
      (group) => group.employeeGroupId === values.employeeGroup.id,
    );
    const employeeNames =
      selectedGroup?.employees.map((employee) => employee.name).filter(Boolean).join(", ") ?? "";

    return buildDefaultRouteAssignmentName(values.date, employeeNames, values.vehicle.name);
  }, [employeeGroups, values.employeeGroup.id, values.date, values.vehicle.name]);

  useEffect(() => {
    if (nameEdited) return;
    setValues((current) => (current.name === defaultName ? current : { ...current, name: defaultName }));
  }, [defaultName, nameEdited]);

  function updateField<K extends keyof RouteAssignmentFormValues>(key: K, value: RouteAssignmentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleVehicleChange(vehicleRecordId: string) {
    const vehicle = vehicles.find((entry) => entry.id === vehicleRecordId);
    updateField("vehicle", {
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

    setNameEdited(true);
    setValues(copyRouteAssignmentFormValues(source, values.createdBy));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        {!isEditing && copySources.length > 0 ? (
          <section className="rounded-lg border border-dashed border-primary/40 bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <Copy className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="copyFrom">Copy from existing assignment</Label>
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

        <FormSection icon={ClipboardList} title="Assignment">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
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

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => {
                  setNameEdited(true);
                  updateField("name", event.target.value);
                }}
                placeholder="Brooklyn morning run"
                required
              />
            </div>

            <div className="space-y-1">
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

            <div className="space-y-1">
              <Label htmlFor="vehicleId">Vehicle</Label>
              <SearchableSelect
                id="vehicleId"
                value={values.vehicle.id}
                onValueChange={handleVehicleChange}
                placeholder="Select a vehicle"
                searchPlaceholder="Search vehicles…"
                options={[
                  { value: "", label: "No vehicle" },
                  ...vehicles.map((vehicle) => ({
                    value: vehicle.id,
                    label: `${vehicle.name} · ${getBranchLabel(vehicle.branch)}`,
                  })),
                ]}
              />
            </div>

            <div className="space-y-1">
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
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
