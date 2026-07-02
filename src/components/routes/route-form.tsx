"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Copy } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useEmployeeGroupPicker } from "@/lib/employee-groups/hooks/use-employee-groups";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import {
  buildDefaultRouteName,
  formatRouteCopyLabel,
} from "@/lib/routes/display";
import {
  copyRouteFormValues,
  createEmptyRouteForm,
  type Route,
  type RouteFormValues,
  type RouteType,
} from "@/lib/routes/types";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";
import { getBranchLabel } from "@/lib/vehicles/display";

function formatEmployeeGroupOptionLabel(group: EmployeeGroupOption): string {
  return group.name?.trim() || group.employeeGroupId;
}

type RouteFormProps = {
  initialValues?: RouteFormValues;
  copySources?: Route[];
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: RouteFormValues) => void;
  onCancel: () => void;
};

export function RouteForm({
  initialValues,
  copySources = [],
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const [values, setValues] = useState<RouteFormValues>(
    initialValues ?? createEmptyRouteForm(),
  );
  const { data: vehiclesData } = useVehiclePicker();
  const vehicles = vehiclesData?.items ?? [];
  const { data: employeeGroupsData } = useEmployeeGroupPicker();
  const employeeGroups = employeeGroupsData?.items ?? [];
  const { data: containersData } = useContainerPicker(200, {
    enabled: values.routeType === "delivery",
  });
  const containers = useMemo(
    () => containersData?.items ?? [],
    [containersData?.items],
  );
  const containerOptions = useMemo(() => {
    const options = containers.map((container) => ({
      value: String(container.id),
      label: formatContainerLabel(container),
    }));

    if (
      values.container &&
      !containers.some((container) => container.id === values.container?.id)
    ) {
      options.unshift({
        value: String(values.container.id),
        label: values.container.name,
      });
    }

    return options;
  }, [containers, values.container]);
  const [copyFromId, setCopyFromId] = useState("");
  const [nameEdited, setNameEdited] = useState(isEditing);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteForm());
    setCopyFromId("");
    setNameEdited(isEditing);
  }, [initialValues, isEditing]);

  useEffect(() => {
    if (values.routeType !== "delivery" || values.container || containers.length === 0) return;
    const first = containers[0];
    setValues((current) =>
      current.routeType === "delivery" && !current.container
        ? { ...current, container: { id: first.id, name: first.name } }
        : current,
    );
  }, [containers, values.container, values.routeType]);

  const defaultName = useMemo(() => {
    const selectedGroup = employeeGroups.find(
      (group) => group.id === values.employeeGroup.id,
    );
    const employeeNames =
      selectedGroup?.employees.map((employee) => employee.name).filter(Boolean).join(", ") ?? "";

    return buildDefaultRouteName(values.date, employeeNames, values.vehicle.name);
  }, [employeeGroups, values.employeeGroup.id, values.date, values.vehicle.name]);

  useEffect(() => {
    if (nameEdited) return;
    setValues((current) => (current.name === defaultName ? current : { ...current, name: defaultName }));
  }, [defaultName, nameEdited]);

  function updateField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
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
    const group = employeeGroups.find((entry) => entry.id === groupId);
    updateField("employeeGroup", {
      id: groupId,
      name: group ? formatEmployeeGroupOptionLabel(group) : "",
    });
  }

  function handleRouteTypeChange(routeType: RouteType) {
    setValues((current) => ({
      ...current,
      routeType,
      container:
        routeType === "delivery"
          ? current.container ?? (containers[0] ? { id: containers[0].id, name: containers[0].name } : null)
          : null,
    }));
  }

  function handleContainerChange(containerId: string) {
    const id = Number(containerId);
    const container = containers.find((entry) => entry.id === id);
    updateField("container", container ? { id: container.id, name: container.name } : null);
  }

  function handleCopyFrom(sourceId: string) {
    setCopyFromId(sourceId);
    if (!sourceId) return;

    const source = copySources.find(
      (assignment) => assignment.routeId === sourceId || assignment.id === sourceId,
    );
    if (!source) return;

    setNameEdited(false);
    setValues(
      copyRouteFormValues(source, values, {
        vehicles,
        employeeGroups,
      }),
    );
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
                      value: assignment.routeId,
                      label: formatRouteCopyLabel(assignment),
                    })),
                  ]}
                />
              </div>
            </div>
          </section>
        ) : null}

        <FormSection
          icon={ClipboardList}
          title="Route"
          action={
            <div
              className="inline-flex overflow-hidden rounded-md border border-border bg-muted p-0.5"
              role="radiogroup"
              aria-label="Route type"
            >
              {(["pickup", "delivery"] as const).map((routeType) => {
                const selected = values.routeType === routeType;
                return (
                  <button
                    key={routeType}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleRouteTypeChange(routeType)}
                    className={
                      selected
                        ? "rounded-sm bg-emerald-600 px-4 py-1.5 text-xs font-medium capitalize text-white"
                        : "rounded-sm bg-muted px-4 py-1.5 text-xs font-medium capitalize text-muted-foreground hover:bg-muted/80"
                    }
                  >
                    {routeType}
                  </button>
                );
              })}
            </div>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {isEditing ? (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="routeId">
                  Assignment number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="routeId"
                  value={values.routeId}
                  onChange={(event) => updateField("routeId", event.target.value)}
                  placeholder="ras-001"
                  className="font-mono text-xs"
                  required
                />
              </div>
            ) : null}

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="date"
                value={values.date}
                onChange={(event) => updateField("date", event.target.value)}
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
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
                    value: group.id,
                    label: formatEmployeeGroupOptionLabel(group),
                  })),
                ]}
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

            <div className="space-y-1 sm:col-span-2">
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

            {values.routeType === "delivery" ? (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="containerId">
                  Container <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="containerId"
                  value={values.container ? String(values.container.id) : ""}
                  onValueChange={handleContainerChange}
                  placeholder="Select a container"
                  searchPlaceholder="Search containers…"
                  required
                  options={containerOptions}
                />
              </div>
            ) : null}
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={externalError}
        onCancel={onCancel}
      />
    </form>
  );
}
