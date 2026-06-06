"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function RouteViewSheet({ route, open, onOpenChange, onEdit, onDelete }: RouteViewSheetProps) {
  if (!route) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>{route.name}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span>{route.routeId}</span>
            <Badge className={getRouteBranchBadgeClass(route.branch)}>{getRouteBranchLabel(route.branch)}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Route ID" value={route.routeId} />
            <DetailRow label="Branch" value={getRouteBranchLabel(route.branch)} />
            <DetailRow label="Date created" value={formatRouteDate(route.createdAt)} />
            <DetailRow label="User created" value={route.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(route.updatedAt)} />
            <DetailRow label="Places" value={route.places.length} />
          </div>

          <div className="mt-4 rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Route content ({route.places.length})
            </p>
            {route.places.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {route.places.map((place) => (
                  <li key={place.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{place.value}</span>
                    <Badge className={getPlaceKindBadgeClass(place.kind)}>{getPlaceKindLabel(place.kind)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No places on this route.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {route.places.map((place) => formatPlaceLabel(place)).join(" · ")}
            </p>
          </div>

          <div className="mt-6 flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(route)}>
              <Pencil className="h-4 w-4" />
              Edit route
            </Button>
            <Button variant="destructive" onClick={() => onDelete(route)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
