"use client";

import { CalendarCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
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
      <FormBody>
        <FormSection icon={Truck} title="Vehicle">
          <div className="space-y-2.5">
            <div className="space-y-1">
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

            <div className="space-y-1">
              <Label htmlFor="vin">VIN</Label>
              <Input
                id="vin"
                value={values.vin}
                onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
                placeholder="1FUJGLDR57LM12345"
                className="font-mono text-xs"
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
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

              <div className="space-y-1">
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
          </div>
        </FormSection>

        <FormSection icon={CalendarCheck} title="Compliance">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <Input
                id="inspectionDate"
                type="date"
                value={values.inspectionDate}
                onChange={(event) => updateField("inspectionDate", event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="registrationDate">Registration date</Label>
              <Input
                id="registrationDate"
                type="date"
                value={values.registrationDate}
                onChange={(event) => updateField("registrationDate", event.target.value)}
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
