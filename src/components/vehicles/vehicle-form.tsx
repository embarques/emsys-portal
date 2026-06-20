"use client";

import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VEHICLE_FUEL_TYPES,
  createEmptyVehicleForm,
  type VehicleFormValues,
} from "@/lib/vehicles/types";

type VehicleFormProps = {
  initialValues?: VehicleFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: VehicleFormValues) => void;
  onCancel: () => void;
};

export function VehicleForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? createEmptyVehicleForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyVehicleForm());
  }, [initialValues]);

  function updateField<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Unit 12 — Freightliner"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vin">VIN</Label>
        <Input
          id="vin"
          value={values.vin}
          onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
          placeholder="1FUJGLDR57LM12345"
          className="font-mono text-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            min={1980}
            max={new Date().getFullYear() + 1}
            value={values.year}
            onChange={(event) => updateField("year", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuelType">Fuel type</Label>
          <Input
            id="fuelType"
            list="vehicle-fuel-types"
            value={values.fuelType}
            onChange={(event) => updateField("fuelType", event.target.value)}
            placeholder="diesel"
          />
          <datalist id="vehicle-fuel-types">
            {VEHICLE_FUEL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inspectionDate">Inspection date</Label>
          <Input
            id="inspectionDate"
            type="date"
            value={values.inspectionDate}
            onChange={(event) => updateField("inspectionDate", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="registrationDate">Registration date</Label>
          <Input
            id="registrationDate"
            type="date"
            value={values.registrationDate}
            onChange={(event) => updateField("registrationDate", event.target.value)}
          />
        </div>
      </div>

      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        {externalError ? (
          <p className="mb-3 text-sm text-destructive">{externalError}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
