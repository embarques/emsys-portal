"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { FUEL_TYPES, TRUCK_BRANCHES, createEmptyTruckForm, type TruckFormValues } from "@/lib/trucks/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type TruckFormProps = {
  initialValues?: TruckFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: TruckFormValues) => void;
  onCancel: () => void;
};

export function TruckForm({ initialValues, isEditing = false, updatedAt, submitLabel, onSubmit, onCancel }: TruckFormProps) {
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
        <Label htmlFor="truckId">Truck ID</Label>
        <Input id="truckId" value={values.truckId} readOnly className="bg-muted/40 font-mono text-xs" />
        {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new trucks.</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">
          Truck name <span className="text-destructive">*</span>
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
        <Label htmlFor="vin">
          VIN <span className="text-destructive">*</span>
        </Label>
        <Input
          id="vin"
          value={values.vin}
          onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
          placeholder="1FUJGLDR57LM12345"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="year">
            Year <span className="text-destructive">*</span>
          </Label>
          <Input
            id="year"
            type="number"
            min={1980}
            max={new Date().getFullYear() + 1}
            value={values.year}
            onChange={(event) => updateField("year", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fuelType">
            Fuel type <span className="text-destructive">*</span>
          </Label>
          <select
            id="fuelType"
            className={selectClassName}
            value={values.fuelType}
            onChange={(event) => updateField("fuelType", event.target.value as TruckFormValues["fuelType"])}
            required
          >
            {FUEL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">
          Branch <span className="text-destructive">*</span>
        </Label>
        <select
          id="branch"
          className={selectClassName}
          value={values.branch}
          onChange={(event) => updateField("branch", event.target.value as TruckFormValues["branch"])}
          required
        >
          {TRUCK_BRANCHES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
