"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import type { RouteAssignment } from "@/lib/route-assignments/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
          <select
            id="activeRouteAssignment"
            className={selectClassName}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required
          >
            <option value="">Select a route assignment…</option>
            {routeAssignments.map((assignment) => (
              <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                {formatRouteAssignmentCopyLabel(assignment)}
              </option>
            ))}
          </select>
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
              <Link href="/route-assignments" className="font-medium text-primary underline-offset-4 hover:underline">
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
