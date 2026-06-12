"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TRUCK_BRANCH_OPTIONS,
  TRUCK_FUEL_TYPES,
  createEmptyTruckForm,
  type TruckFormValues,
} from "@/lib/trucks/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type TruckFormProps = {
  initialValues?: TruckFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: TruckFormValues) => void;
  onCancel: () => void;
};

export function TruckForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: TruckFormProps) {
  const [values, setValues] = useState<TruckFormValues>(initialValues ?? createEmptyTruckForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyTruckForm());
  }, [initialValues]);

  function updateField<K extends keyof TruckFormValues>(key: K, value: TruckFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="id">Truck ID</Label>
        <Input
          id="id"
          value={values.id || "Assigned after save"}
          readOnly
          className="bg-muted/40 font-mono text-xs"
        />
        {!isEditing ? (
          <p className="text-xs text-muted-foreground">The EMSYS API assigns the record id on create.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="truckId">
          truckId <span className="text-destructive">*</span>
        </Label>
        <Input
          id="truckId"
          value={values.truckId}
          onChange={(event) => updateField("truckId", event.target.value)}
          placeholder="trk-001"
          className="font-mono text-xs"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">
          name <span className="text-destructive">*</span>
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
        <Label htmlFor="vin">vin</Label>
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
          <Label htmlFor="year">year</Label>
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
          <Label htmlFor="fuelType">fuelType</Label>
          <Input
            id="fuelType"
            list="truck-fuel-types"
            value={values.fuelType}
            onChange={(event) => updateField("fuelType", event.target.value)}
            placeholder="diesel"
          />
          <datalist id="truck-fuel-types">
            {TRUCK_FUEL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">branch</Label>
        <Input
          id="branch"
          list="truck-branch-options"
          value={values.branch}
          onChange={(event) => updateField("branch", event.target.value)}
          placeholder="usa"
        />
        <datalist id="truck-branch-options">
          {TRUCK_BRANCH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </datalist>
      </div>

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
