"use client";

import { useState, type ComponentType } from "react";
import { ArrowLeft, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StatCardDetail = {
  label: string;
  value: string;
};

type FlippableStatCardProps = {
  label: string;
  value: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  details?: StatCardDetail[];
};

type FlipActionProps = {
  label: string;
  onClick: () => void;
  tabIndex: number;
  icon: ComponentType<{ className?: string }>;
};

function FlipAction({ label, onClick, tabIndex, icon: Icon }: FlipActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="absolute bottom-4 right-4 size-8"
          onClick={onClick}
          size="icon"
          tabIndex={tabIndex}
          type="button"
          variant="outline"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A fixed-height KPI card with accessible summary and details faces. */
export function FlippableStatCard({
  label,
  value,
  description,
  icon: Icon,
  details,
}: FlippableStatCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const resolvedDetails = details?.length
    ? details
    : [
        { label: "Current value", value },
        { label: "Summary", value: description || "Current metric" },
      ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="[perspective:1000px]" style={{ height: 158 }}>
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            showDetails && "[transform:rotateY(180deg)]",
          )}
        >
          <Card
            aria-hidden={showDetails}
            className="absolute inset-0 h-full [backface-visibility:hidden]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pr-16">
              <div className="text-2xl font-bold">{value}</div>
              <CardDescription className="mt-1">{description ?? "\u00a0"}</CardDescription>
            </CardContent>
            <FlipAction
              icon={Info}
              label={`View ${label} details`}
              onClick={() => setShowDetails(true)}
              tabIndex={showDetails ? -1 : 0}
            />
          </Card>

          <Card
            aria-hidden={!showDetails}
            className="absolute inset-0 h-full gap-2 py-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5">
              <CardTitle className="text-sm font-semibold">{label} details</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-0 px-5 pr-16 text-xs">
              {resolvedDetails.map((detail, index) => (
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 py-1.5",
                    index < resolvedDetails.length - 1 && "border-b",
                  )}
                  key={detail.label}
                >
                  <span className="truncate text-muted-foreground">{detail.label}</span>
                  <span className="min-w-0 max-w-[60%] truncate text-right font-medium tabular-nums">
                    {detail.value}
                  </span>
                </div>
              ))}
            </CardContent>
            <FlipAction
              icon={ArrowLeft}
              label={`Back to ${label} summary`}
              onClick={() => setShowDetails(false)}
              tabIndex={showDetails ? 0 : -1}
            />
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
