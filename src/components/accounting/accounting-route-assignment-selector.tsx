"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import type { RouteAssignment } from "@/lib/route-assignments/types";

type AccountingRouteAssignmentSelectorProps = {
  routeAssignments: RouteAssignment[];
  value: string;
  onChange: (routeAssignmentId: string) => void;
};

export function AccountingRouteAssignmentSelector({
  routeAssignments,
  value,
  onChange,
}: AccountingRouteAssignmentSelectorProps) {
  return (
    <Card className="mt-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          Route assignment required
        </CardTitle>
        <CardDescription>
          Select the active route assignment before registering payments, discounts, income, or expenses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xl space-y-2">
          <Label htmlFor="activeRouteAssignment">
            Route assignment <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="activeRouteAssignment"
            value={value}
            onValueChange={onChange}
            placeholder="Select a route assignment…"
            searchPlaceholder="Search route assignments…"
            required
            options={[
              { value: "", label: "Select a route assignment…" },
              ...routeAssignments.map((assignment) => ({
                value: assignment.routeAssignmentId,
                label: formatRouteAssignmentCopyLabel(assignment),
              })),
            ]}
          />
          {!value ? (
            <p className="text-sm text-destructive">
              Choose a route assignment to unlock the forms below.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              New entries will be registered under this route assignment.
            </p>
          )}
          {routeAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No route assignments available.{" "}
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
