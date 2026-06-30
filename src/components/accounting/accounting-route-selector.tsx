"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRouteCopyLabel } from "@/lib/routes/display";
import type { Route } from "@/lib/routes/types";

type AccountingRouteSelectorProps = {
  routes: Route[];
  value: string;
  onChange: (routeId: string) => void;
};

export function AccountingRouteSelector({
  routes,
  value,
  onChange,
}: AccountingRouteSelectorProps) {
  return (
    <Card className="mt-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          Route required
        </CardTitle>
        <CardDescription>
          Select the active route before registering payments, discounts, income, or expenses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xl space-y-2">
          <Label htmlFor="activeRoute">
            Route <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="activeRoute"
            value={value}
            onValueChange={onChange}
            placeholder="Select a route…"
            searchPlaceholder="Search routes…"
            required
            options={[
              { value: "", label: "Select a route…" },
              ...routes.map((assignment) => ({
                value: assignment.routeId,
                label: formatRouteCopyLabel(assignment),
              })),
            ]}
          />
          {!value ? (
            <p className="text-sm text-destructive">
              Choose a route to unlock the forms below.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              New entries will be registered under this route.
            </p>
          )}
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routes available.{" "}
              <Link href="/routes" className="font-medium text-primary underline-offset-4 hover:underline">
                Create one first
              </Link>
              .
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
