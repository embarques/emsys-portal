import type { ComponentType, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PeriodStatCardProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: ReactNode;
  description: ReactNode;
  periodControl: ReactNode;
};

/** Fixed-height KPI card whose comparison line and timeframe control share one row. */
export function PeriodStatCard({
  label,
  icon: Icon,
  value,
  description,
  periodControl,
}: PeriodStatCardProps) {
  return (
    <div className="min-w-0" style={{ height: 158 }}>
      <Card className="h-full min-w-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex min-w-0 items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-bold">{value}</div>
            <CardDescription className="mt-1 line-clamp-2">{description}</CardDescription>
          </div>
          <div
            className="inline-flex shrink-0"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {periodControl}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
