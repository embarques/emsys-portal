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
  formatPlaceLabel,
  formatRouteDate,
  getPlaceKindBadgeClass,
  getPlaceKindLabel,
  getRouteBranchBadgeClass,
  getRouteBranchLabel,
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

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={route.name}
          description={<span className="font-mono text-xs">{route.routeId}</span>}
          meta={
            <Badge className={getRouteBranchBadgeClass(route.branch)}>{getRouteBranchLabel(route.branch)}</Badge>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Route">
            <RecordViewSheetDetailRow label="Route ID" value={route.routeId} />
            <RecordViewSheetDetailRow label="Branch" value={getRouteBranchLabel(route.branch)} />
            <RecordViewSheetDetailRow label="Date created" value={formatRouteDate(route.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={route.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(route.updatedAt)} />
            <RecordViewSheetDetailRow label="Places" value={route.places.length} />
          </RecordViewSheetSection>

          <RecordViewSheetSection title={`Route content (${route.places.length})`} padding="relaxed">
            {route.places.length > 0 ? (
              <>
                <ul className="space-y-3">
                  {route.places.map((place) => (
                    <li
                      key={place.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{place.value}</span>
                      <Badge className={getPlaceKindBadgeClass(place.kind)}>{getPlaceKindLabel(place.kind)}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {route.places.map((place) => formatPlaceLabel(place)).join(" · ")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No places on this route.</p>
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit route" onEdit={() => onEdit(route)} onDelete={() => onDelete(route)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
