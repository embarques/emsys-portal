"use client";

import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { useGoogleMapsApiKey } from "@/lib/company/hooks/use-current-company";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import {
  routeEndpointsSchema,
  routeEndpointFormFields,
  toRouteEndpointLocations,
  type RouteEndpointsFormValues,
  type RouteEndpointLocations,
} from "@/lib/orders/schemas/route-endpoints.schema";

export function RouteEndpointsDialog({ defaultValues, branchHasLocation, onClose, onSubmit, isPending }: {
  defaultValues: RouteEndpointsFormValues;
  branchHasLocation: boolean;
  onClose: () => void;
  onSubmit: (endpoints: RouteEndpointLocations) => Promise<void>;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const googleMapsApiKey = useGoogleMapsApiKey();
  const form = useForm<RouteEndpointsFormValues>({
    resolver: zodResolver(routeEndpointsSchema),
    defaultValues,
  });
  const busy = isPending || form.formState.isSubmitting;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{t("orders.optimize.endpoints.title")}</DialogTitle>
          <DialogDescription>
            {t(branchHasLocation ? "orders.optimize.endpoints.branchDefaultDescription" : "orders.optimize.endpoints.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => onSubmit(toRouteEndpointLocations(values)))} className="space-y-4" noValidate>
          {(["start", "end"] as const).map((endpoint) => (
            <fieldset key={endpoint} disabled={busy} className="space-y-2">
              <legend className="text-sm font-medium">{t(`orders.optimize.endpoints.${endpoint}`)}</legend>
              <label htmlFor={`${id}-${endpoint}`} className="sr-only">{t(`orders.optimize.endpoints.${endpoint}`)}</label>
              <Controller
                name={`${endpoint}Address`}
                control={form.control}
                render={({ field }) => (
                  <AddressAutocompleteInput
                    id={`${id}-${endpoint}`}
                    value={field.value}
                    disabled={busy || !googleMapsApiKey}
                    placeholder={t("orders.optimize.endpoints.searchAddress")}
                    onValueChange={(address) => {
                      const fields = routeEndpointFormFields(endpoint, address);
                      for (const [name, value] of Object.entries(fields)) {
                        form.setValue(name as keyof RouteEndpointsFormValues, value, { shouldDirty: true });
                      }
                    }}
                    onPlaceSelected={(place) => {
                      const address = [place.address1, place.city, place.state, place.zipcode, place.country].filter(Boolean).join(", ");
                      const fields = routeEndpointFormFields(endpoint, address, place);
                      for (const [name, value] of Object.entries(fields)) {
                        form.setValue(name as keyof RouteEndpointsFormValues, value, { shouldDirty: true, shouldValidate: true });
                      }
                    }}
                  />
                )}
              />
              {form.formState.errors[`${endpoint}Address`] || form.formState.errors[`${endpoint}Longitude`] || form.formState.errors[`${endpoint}Latitude`] ? (
                <p role="alert" className="text-xs text-destructive">{t("orders.optimize.endpoints.selectAddress")}</p>
              ) : null}
            </fieldset>
          ))}
          {!googleMapsApiKey ? <p role="alert" className="text-sm text-destructive">{t("orders.map.errors.missingApiKey")}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common.actions.cancel")}</Button>
            <Button type="submit" disabled={busy || !googleMapsApiKey}>{t(busy ? "orders.actions.optimizingRoute" : "orders.actions.optimizeRoute")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
