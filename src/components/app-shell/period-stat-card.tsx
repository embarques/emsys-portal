import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PeriodStatCardProps = {
  label: string;
  value: ReactNode;
  description: ReactNode;
  periodControl: ReactNode;
};

/** Fixed-height KPI card with a header timeframe control and full-width comparison. */
export function PeriodStatCard({
  label,
  value,
  description,
  periodControl,
}: PeriodStatCardProps) {
  return (
    <div className="min-w-0" style={{ height: 158 }}>
      <Card className="h-full min-w-0 gap-2">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <div
            className="inline-flex shrink-0"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {periodControl}
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="truncate text-2xl font-bold">{value}</div>
          <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
