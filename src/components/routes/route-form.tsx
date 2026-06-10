"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROUTE_BRANCHES,
  ROUTE_PLACE_KINDS,
  createEmptyPlace,
  createEmptyRouteForm,
  type RouteFormValues,
  type RoutePlaceFormValues,
} from "@/lib/routes/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type RouteFormProps = {
  initialValues?: RouteFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: RouteFormValues) => void;
  onCancel: () => void;
};

export function RouteForm({ initialValues, isEditing = false, updatedAt, submitLabel, onSubmit, onCancel }: RouteFormProps) {
  const [values, setValues] = useState<RouteFormValues>(initialValues ?? createEmptyRouteForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteForm());
    setFormError(null);
  }, [initialValues]);

  function updateField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updatePlace(index: number, patch: Partial<RoutePlaceFormValues>) {
    setValues((current) => ({
      ...current,
      places: current.places.map((place, placeIndex) => (placeIndex === index ? { ...place, ...patch } : place)),
    }));
    setFormError(null);
  }

  function addPlace() {
    setValues((current) => ({ ...current, places: [...current.places, createEmptyPlace()] }));
  }

  function removePlace(index: number) {
    setValues((current) => {
      if (current.places.length <= 1) return current;
      return { ...current, places: current.places.filter((_, placeIndex) => placeIndex !== index) };
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validPlaces = values.places.filter((place) => place.value.trim());
    if (validPlaces.length === 0) {
      setFormError("Add at least one city, state, zip code, or zip range.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="routeId">Route ID</Label>
          <Input id="routeId" value={values.routeId} readOnly className="bg-muted/40 font-mono text-xs" />
          {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new routes.</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Route name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Brooklyn — Manhattan Express"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) => updateField("branch", event.target.value as RouteFormValues["branch"])}
            required
          >
            {ROUTE_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Route content</h3>
            <p className="text-sm text-muted-foreground">
              At least one place is required. Add cities, states, zip codes, or zip ranges.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPlace}>
            <Plus className="h-4 w-4" />
            Add place
          </Button>
        </div>

        <div className="space-y-3">
          {values.places.map((place, index) => {
            const kindMeta = ROUTE_PLACE_KINDS.find((entry) => entry.value === place.kind) ?? ROUTE_PLACE_KINDS[0];

            return (
              <div key={place.id} className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Place {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={values.places.length <= 1}
                    onClick={() => removePlace(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`place-kind-${place.id}`}>Type</Label>
                    <select
                      id={`place-kind-${place.id}`}
                      className={selectClassName}
                      value={place.kind}
                      onChange={(event) =>
                        updatePlace(index, { kind: event.target.value as RoutePlaceFormValues["kind"] })
                      }
                    >
                      {ROUTE_PLACE_KINDS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`place-value-${place.id}`}>
                      Value {index === 0 ? <span className="text-destructive">*</span> : null}
                    </Label>
                    <Input
                      id={`place-value-${place.id}`}
                      value={place.value}
                      onChange={(event) => updatePlace(index, { value: event.target.value })}
                      placeholder={kindMeta.placeholder}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
