"use client";

import { CalendarDays, Container, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  employeeGroupOptions: SearchableSelectOption[];
  employeeGroupSearchLoading?: boolean;
  onEmployeeGroupSearchChange?: (query: string) => void;
  onAddEmployeeGroup?: () => void;
  createdEmployeeGroupId?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: DeliveryFormValues) => void;
  onCancel: () => void;
};

export function DeliveryForm({
  initialValues,
  containerOptions,
  employeeGroupOptions,
  employeeGroupSearchLoading = false,
  onEmployeeGroupSearchChange,
  onAddEmployeeGroup,
  createdEmployeeGroupId,
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

  useEffect(() => {
    if (!createdEmployeeGroupId) return;
    setValues((current) => ({ ...current, employeeGroupId: createdEmployeeGroupId }));
    setLocalError(null);
  }, [createdEmployeeGroupId]);

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

        <FormSection icon={Users} title="Employee group" required>
          <div className="space-y-1">
            <Label htmlFor="delivery-employee-group">
              Employee group <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <SearchableSelect
                id="delivery-employee-group"
                value={values.employeeGroupId}
                onValueChange={(value) => updateField("employeeGroupId", value)}
                options={employeeGroupOptions}
                placeholder="Select employee group"
                searchPlaceholder="Search groups or employees..."
                emptyMessage="No employee groups found."
                loading={employeeGroupSearchLoading}
                manualFiltering
                onSearchChange={onEmployeeGroupSearchChange}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Create employee group"
                title="Create employee group"
                onClick={onAddEmployeeGroup}
              >
                <Plus className="size-4" />
              </Button>
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
