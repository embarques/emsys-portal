"use client";

import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmptyContainerForm,
  type ContainerFormValues,
} from "@/lib/containers/types";

type ContainerFormProps = {
  initialValues?: ContainerFormValues;
  isEditing?: boolean;
  suggestedContainerName?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: ContainerFormValues) => void;
  onCancel: () => void;
};

export function ContainerForm({
  initialValues,
  isEditing = false,
  suggestedContainerName,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: ContainerFormProps) {
  const [values, setValues] = useState<ContainerFormValues>(initialValues ?? createEmptyContainerForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    const base = initialValues ?? createEmptyContainerForm();
    setValues(
      !isEditing && suggestedContainerName && !base.name
        ? { ...base, name: suggestedContainerName }
        : base,
    );
  }, [initialValues, isEditing, suggestedContainerName]);

  function updateField<K extends keyof ContainerFormValues>(key: K, value: ContainerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Container <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="01-26"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="containerNumber">Container number</Label>
          <Input
            id="containerNumber"
            value={values.containerNumber}
            onChange={(event) => updateField("containerNumber", event.target.value.toUpperCase())}
            placeholder="SMLUD320939203"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking">
            Booking number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="booking"
            value={values.booking}
            onChange={(event) => updateField("booking", event.target.value)}
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
          <Label htmlFor="company">Transport company</Label>
          <Input
            id="company"
            value={values.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="Shipping line or carrier"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost">Cost</Label>
          <Input
            id="cost"
            type="number"
            min={0}
            step="0.01"
            value={values.cost}
            onChange={(event) => updateField("cost", event.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="departureDate">Departure date</Label>
          <Input
            id="departureDate"
            type="date"
            value={values.departureDate}
            onChange={(event) => updateField("departureDate", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="arrivalDate">Arrival date</Label>
          <Input
            id="arrivalDate"
            type="date"
            value={values.arrivalDate}
            onChange={(event) => updateField("arrivalDate", event.target.value)}
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
