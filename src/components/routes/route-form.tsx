"use client";

import { useEffect, useState } from "react";
import { Building2, Hash, MapPin, Plus, Route as RouteIcon, Trash2 } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countRouteFormEntries,
  createEmptyCity,
  createEmptyRouteForm,
  createEmptyState,
  createEmptyZipCode,
  createEmptyZipRange,
  type RouteFormValues,
} from "@/lib/routes/types";

type RouteFormProps = {
  initialValues?: RouteFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  externalError?: string | null;
  isSubmitting?: boolean;
  onSubmit: (values: RouteFormValues) => void;
  onCancel: () => void;
};

export function RouteForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  externalError = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const [values, setValues] = useState<RouteFormValues>(initialValues ?? createEmptyRouteForm());
  const [formError, setFormError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteForm());
    setFormError(null);
  }, [initialValues]);

  function updateName(value: string) {
    setValues((current) => ({ ...current, name: value }));
    setFormError(null);
  }

  function updateCity(index: number, patch: Partial<{ cityName: string; stateCode: string }>) {
    setValues((current) => ({
      ...current,
      cities: current.cities.map((city, cityIndex) => (cityIndex === index ? { ...city, ...patch } : city)),
    }));
    setFormError(null);
  }

  function updateState(index: number, value: string) {
    setValues((current) => ({
      ...current,
      states: current.states.map((state, stateIndex) => (stateIndex === index ? { ...state, value } : state)),
    }));
    setFormError(null);
  }

  function updateZipCode(index: number, value: string) {
    setValues((current) => ({
      ...current,
      zipCodes: current.zipCodes.map((zip, zipIndex) => (zipIndex === index ? { ...zip, value } : zip)),
    }));
    setFormError(null);
  }

  function updateZipRange(index: number, patch: Partial<{ start: string; end: string }>) {
    setValues((current) => ({
      ...current,
      zipRanges: current.zipRanges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, ...patch } : range,
      ),
    }));
    setFormError(null);
  }

  function addCity() {
    setValues((current) => ({ ...current, cities: [...current.cities, createEmptyCity()] }));
  }

  function removeCity(index: number) {
    setValues((current) => ({
      ...current,
      cities: current.cities.filter((_, cityIndex) => cityIndex !== index),
    }));
  }

  function addState() {
    setValues((current) => ({ ...current, states: [...current.states, createEmptyState()] }));
  }

  function removeState(index: number) {
    setValues((current) => ({
      ...current,
      states: current.states.filter((_, stateIndex) => stateIndex !== index),
    }));
  }

  function addZipCode() {
    setValues((current) => ({ ...current, zipCodes: [...current.zipCodes, createEmptyZipCode()] }));
  }

  function removeZipCode(index: number) {
    setValues((current) => ({
      ...current,
      zipCodes: current.zipCodes.filter((_, zipIndex) => zipIndex !== index),
    }));
  }

  function addZipRange() {
    setValues((current) => ({ ...current, zipRanges: [...current.zipRanges, createEmptyZipRange()] }));
  }

  function removeZipRange(index: number) {
    setValues((current) => ({
      ...current,
      zipRanges: current.zipRanges.filter((_, rangeIndex) => rangeIndex !== index),
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.name.trim()) {
      setFormError("Route name is required.");
      return;
    }

    if (countRouteFormEntries(values) === 0) {
      setFormError("Add at least one city, state, zip code, or zip range.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={RouteIcon} title="Route">
          <div className="space-y-1">
            <Label htmlFor="name">
              Route name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => updateName(event.target.value)}
              placeholder="Brooklyn — Manhattan Express"
              required
            />
          </div>
        </FormSection>

        <FormSection
          icon={MapPin}
          title="Cities"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addCity}>
              <Plus className="h-4 w-4" />
              Add city
            </Button>
          }
        >
          {values.cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cities added.</p>
          ) : (
            <div className="space-y-2.5">
              {values.cities.map((city, index) => (
                <div key={city.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`city-name-${city.id}`}>City</Label>
                    <Input
                      id={`city-name-${city.id}`}
                      value={city.cityName}
                      onChange={(event) => updateCity(index, { cityName: event.target.value })}
                      placeholder="Brooklyn"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label htmlFor={`city-state-${city.id}`}>State</Label>
                    <Input
                      id={`city-state-${city.id}`}
                      value={city.stateCode}
                      onChange={(event) => updateCity(index, { stateCode: event.target.value })}
                      placeholder="NY"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeCity(index)}
                    aria-label="Remove city"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection
          icon={Building2}
          title="States"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addState}>
              <Plus className="h-4 w-4" />
              Add state
            </Button>
          }
        >
          {values.states.length === 0 ? (
            <p className="text-sm text-muted-foreground">No states added.</p>
          ) : (
            <div className="space-y-2.5">
              {values.states.map((state, index) => (
                <div key={state.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`state-value-${state.id}`}>State</Label>
                    <Input
                      id={`state-value-${state.id}`}
                      value={state.value}
                      onChange={(event) => updateState(index, event.target.value)}
                      placeholder="NY"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeState(index)}
                    aria-label="Remove state"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection
          icon={Hash}
          title="Zip codes"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addZipCode}>
              <Plus className="h-4 w-4" />
              Add zip code
            </Button>
          }
        >
          {values.zipCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zip codes added.</p>
          ) : (
            <div className="space-y-2.5">
              {values.zipCodes.map((zip, index) => (
                <div key={zip.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`zip-value-${zip.id}`}>Zip code</Label>
                    <Input
                      id={`zip-value-${zip.id}`}
                      value={zip.value}
                      onChange={(event) => updateZipCode(index, event.target.value)}
                      placeholder="11201"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeZipCode(index)}
                    aria-label="Remove zip code"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection
          icon={Hash}
          title="Zip ranges"
          action={
            <Button type="button" variant="outline" size="sm" onClick={addZipRange}>
              <Plus className="h-4 w-4" />
              Add zip range
            </Button>
          }
        >
          {values.zipRanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zip ranges added.</p>
          ) : (
            <div className="space-y-2.5">
              {values.zipRanges.map((range, index) => (
                <div key={range.id} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`zip-start-${range.id}`}>Start</Label>
                    <Input
                      id={`zip-start-${range.id}`}
                      value={range.start}
                      onChange={(event) => updateZipRange(index, { start: event.target.value })}
                      placeholder="10001"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`zip-end-${range.id}`}>End</Label>
                    <Input
                      id={`zip-end-${range.id}`}
                      value={range.end}
                      onChange={(event) => updateZipRange(index, { end: event.target.value })}
                      placeholder="10010"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeZipRange(index)}
                    aria-label="Remove zip range"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError ?? formError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
