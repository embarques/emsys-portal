"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import {
  createEmptyContainerForm,
  type ContainerFormValues,
} from "@/lib/containers/types";

type ContainerFormProps = {
  initialValues?: ContainerFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  suggestedContainerCode?: string;
  submitLabel: string;
  onSubmit: (values: ContainerFormValues) => void;
  onCancel: () => void;
};

export function ContainerForm({
  initialValues,
  isEditing = false,
  updatedAt,
  suggestedContainerCode,
  submitLabel,
  onSubmit,
  onCancel,
}: ContainerFormProps) {
  const [values, setValues] = useState<ContainerFormValues>(initialValues ?? createEmptyContainerForm());

  useEffect(() => {
    const base = initialValues ?? createEmptyContainerForm();
    setValues(
      !isEditing && suggestedContainerCode && !base.containerCode
        ? { ...base, containerCode: suggestedContainerCode }
        : base
    );
  }, [initialValues, isEditing, suggestedContainerCode]);

  function updateField<K extends keyof ContainerFormValues>(key: K, value: ContainerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="containerId">Container ID</Label>
        <Input id="containerId" value={values.containerId} readOnly className="bg-muted/40 font-mono text-xs" />
        {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new containers.</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="containerCode">
            Container <span className="text-destructive">*</span>
          </Label>
          <Input
            id="containerCode"
            value={values.containerCode}
            onChange={(event) => updateField("containerCode", event.target.value)}
            placeholder="01-26"
            required
          />
          <p className="text-xs text-muted-foreground">Sequence and year, e.g. 01-26, 02-26.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="containerNumber">
            Container number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="containerNumber"
            value={values.containerNumber}
            onChange={(event) => updateField("containerNumber", event.target.value.toUpperCase())}
            placeholder="SMLUD320939203"
            className="font-mono text-xs"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bookingNumber">
            Booking number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bookingNumber"
            value={values.bookingNumber}
            onChange={(event) => updateField("bookingNumber", event.target.value)}
            placeholder="BKG-2026-00421"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sealNumber">Seal number</Label>
          <Input
            id="sealNumber"
            value={values.sealNumber}
            onChange={(event) => updateField("sealNumber", event.target.value)}
            placeholder="SL-884921"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="broker">Broker</Label>
          <Input
            id="broker"
            value={values.broker}
            onChange={(event) => updateField("broker", event.target.value)}
            placeholder="Customs broker name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="transportCompany">Transport company</Label>
          <Input
            id="transportCompany"
            value={values.transportCompany}
            onChange={(event) => updateField("transportCompany", event.target.value)}
            placeholder="Shipping line or carrier"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">
            Cost <span className="text-destructive">*</span>
          </Label>
          <Input
            id="cost"
            type="number"
            min={0}
            step="0.01"
            value={values.cost}
            onChange={(event) => updateField("cost", event.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="departureDate">
            Departure date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="departureDate"
            type="date"
            value={values.departureDate}
            onChange={(event) => updateField("departureDate", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="arrivalDate">
            Arrival date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="arrivalDate"
            type="date"
            value={values.arrivalDate}
            onChange={(event) => updateField("arrivalDate", event.target.value)}
            required
          />
        </div>
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
