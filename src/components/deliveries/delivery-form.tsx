"use client";

import { CalendarDays, Container, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { deliveryFormSchema } from "@/lib/deliveries/schemas/delivery.schema";
import {
  createEmptyDeliveryForm,
  type DeliveryFormValues,
} from "@/lib/deliveries/types";

type DeliveryFormProps = {
  initialValues?: DeliveryFormValues;
  containerOptions: SearchableSelectOption[];
  employeeOptions: SearchableSelectOption[];
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: DeliveryFormValues) => void;
  onCancel: () => void;
};

export function DeliveryForm({
  initialValues,
  containerOptions,
  employeeOptions,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: DeliveryFormProps) {
  const [values, setValues] = useState<DeliveryFormValues>(initialValues ?? createEmptyDeliveryForm());
  const [localError, setLocalError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyDeliveryForm());
    setLocalError(null);
  }, [initialValues]);

  function updateField<K extends keyof DeliveryFormValues>(key: K, value: DeliveryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setLocalError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = deliveryFormSchema.safeParse(values);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Review the delivery fields.");
      return;
    }
    onSubmit(parsed.data);
  }

  const helperOptions = useMemo(
    () => [{ value: "", label: "No helper" }, ...employeeOptions],
    [employeeOptions],
  );

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={CalendarDays} title="Delivery" required>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="delivery-name">
                Delivery <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delivery-name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Conduce 01-26"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="delivery-date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delivery-date"
                type="date"
                value={values.date}
                onChange={(event) => updateField("date", event.target.value)}
                required
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Container} title="Container" required>
          <div className="space-y-1">
            <Label htmlFor="delivery-container">
              Container <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="delivery-container"
              value={values.containerId}
              onValueChange={(value) => updateField("containerId", value)}
              options={containerOptions}
              placeholder="Select container"
              searchPlaceholder="Search containers..."
              emptyMessage="No containers found."
              required
            />
          </div>
        </FormSection>

        <FormSection icon={Users} title="Crew" required>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="delivery-driver">
                Driver <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="delivery-driver"
                value={values.employeeId}
                onValueChange={(value) => updateField("employeeId", value)}
                options={employeeOptions}
                placeholder="Select driver"
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found."
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="delivery-helper-1">Helper 1</Label>
              <SearchableSelect
                id="delivery-helper-1"
                value={values.helper1Id}
                onValueChange={(value) => updateField("helper1Id", value)}
                options={helperOptions}
                placeholder="Select helper"
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="delivery-helper-2">Helper 2</Label>
              <SearchableSelect
                id="delivery-helper-2"
                value={values.helper2Id}
                onValueChange={(value) => updateField("helper2Id", value)}
                options={helperOptions}
                placeholder="Select helper"
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found."
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={localError ?? externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
