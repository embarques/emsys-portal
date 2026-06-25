"use client";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import {
  countRoutePlaces,
  formatRouteCity,
  formatRouteDate,
  formatRouteZipRange,
  getPlaceKindBadgeClass,
  getPlaceKindLabel,
  getRouteKinds,
} from "@/lib/routes/display";
import { formatAuditDate } from "@/lib/audit/display";
import type { RouteRecord } from "@/lib/routes/types";

type RouteViewSheetProps = {
  route: RouteRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (route: RouteRecord) => void;
  onDelete: (route: RouteRecord) => void;
};

export function RouteViewSheet({ route, open, onOpenChange, onEdit, onDelete }: RouteViewSheetProps) {
  if (!route) return null;

  const totalPlaces = countRoutePlaces(route);
  const kinds = getRouteKinds(route);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={route.name || "Route"}
          description={<span className="font-mono text-xs">{route.routeId}</span>}
          meta={
            kinds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {kinds.map((kind) => (
                  <Badge key={kind} className={getPlaceKindBadgeClass(kind)}>
                    {getPlaceKindLabel(kind)}
                  </Badge>
                ))}
              </div>
            ) : null
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Route">
            <RecordViewSheetDetailRow label="Route ID" value={route.routeId} />
            <RecordViewSheetDetailRow label="Date created" value={formatRouteDate(route.createdAt)} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(route.updatedAt)} />
            <RecordViewSheetDetailRow label="Total places" value={totalPlaces} />
          </RecordViewSheetSection>

          {route.cities.length > 0 ? (
            <RecordViewSheetSection title={`Cities (${route.cities.length})`} padding="relaxed">
              <ul className="space-y-2">
                {route.cities.map((city, index) => (
                  <li
                    key={`${city.cityName}-${index}`}
                    className="rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 text-sm font-medium"
                  >
                    {formatRouteCity(city)}
                  </li>
                ))}
              </ul>
            </RecordViewSheetSection>
          ) : null}

          {route.states.length > 0 ? (
            <RecordViewSheetSection title={`States (${route.states.length})`} padding="relaxed">
              <div className="flex flex-wrap gap-2">
                {route.states.map((state, index) => (
                  <Badge key={`${state}-${index}`} variant="secondary">
                    {state}
                  </Badge>
                ))}
              </div>
            </RecordViewSheetSection>
          ) : null}

          {route.zipCodes.length > 0 ? (
            <RecordViewSheetSection title={`Zip codes (${route.zipCodes.length})`} padding="relaxed">
              <div className="flex flex-wrap gap-2">
                {route.zipCodes.map((zip, index) => (
                  <Badge key={`${zip}-${index}`} variant="secondary" className="font-mono">
                    {zip}
                  </Badge>
                ))}
              </div>
            </RecordViewSheetSection>
          ) : null}

          {route.zipRanges.length > 0 ? (
            <RecordViewSheetSection title={`Zip ranges (${route.zipRanges.length})`} padding="relaxed">
              <ul className="space-y-2">
                {route.zipRanges.map((range, index) => (
                  <li
                    key={`${range.start}-${range.end}-${index}`}
                    className="rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 font-mono text-sm"
                  >
                    {formatRouteZipRange(range)}
                  </li>
                ))}
              </ul>
            </RecordViewSheetSection>
          ) : null}

          {totalPlaces === 0 ? (
            <RecordViewSheetSection title="Route content" padding="relaxed">
              <p className="text-sm text-muted-foreground">No places on this route.</p>
            </RecordViewSheetSection>
          ) : null}
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit route" onEdit={() => onEdit(route)} onDelete={() => onDelete(route)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
