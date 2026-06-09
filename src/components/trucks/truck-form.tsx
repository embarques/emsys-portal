"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuditDate } from "@/lib/audit/display";
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
  onSubmit: (values: TruckFormValues) => void;
  onCancel: () => void;
};

export function TruckForm({
  initialValues,
  isEditing = false,
  submitLabel,
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
        <Label htmlFor="id">id</Label>
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
        <Label htmlFor="vin">
          vin <span className="text-destructive">*</span>
        </Label>
        <Input
          id="vin"
          value={values.vin}
          onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
          placeholder="1FUJGLDR57LM12345"
          className="font-mono text-xs"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="year">
            year <span className="text-destructive">*</span>
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
            fuelType <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fuelType"
            list="truck-fuel-types"
            value={values.fuelType}
            onChange={(event) => updateField("fuelType", event.target.value)}
            placeholder="diesel"
            required
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
        <Label htmlFor="branch">
          branch <span className="text-destructive">*</span>
        </Label>
        <Input
          id="branch"
          list="truck-branch-options"
          value={values.branch}
          onChange={(event) => updateField("branch", event.target.value)}
          placeholder="usa"
          required
        />
        <datalist id="truck-branch-options">
          {TRUCK_BRANCH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </datalist>
      </div>

      {isEditing ? (
        <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">createdAt</p>
            <p className="text-sm">{values.createdAt ? formatAuditDate(values.createdAt) : "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">updatedAt</p>
            <p className="text-sm">{values.updatedAt ? formatAuditDate(values.updatedAt) : "—"}</p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">createdBy</p>
            <p className="text-sm">{values.createdBy || "—"}</p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
