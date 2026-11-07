"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SwitchFieldProps = Omit<React.ComponentPropsWithoutRef<typeof Switch>, "className"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
};

/** A labeled binary setting with an optional description and a consistent touch target. */
export const SwitchField = React.forwardRef<React.ElementRef<typeof Switch>, SwitchFieldProps>(
  function SwitchField({ id, label, description, className, ...props }, ref) {
    const generatedId = React.useId();
    const controlId = id ?? generatedId;
    const descriptionId = `${controlId}-description`;

    return (
      <div className={cn("flex min-w-0 items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3", className)}>
        <div className="min-w-0 space-y-1">
          <Label htmlFor={controlId}><span className="break-words">{label}</span></Label>
          {description ? <div id={descriptionId} className="text-xs text-muted-foreground">{description}</div> : null}
        </div>
        <Switch
          ref={ref}
          id={controlId}
          aria-describedby={description ? descriptionId : undefined}
          {...props}
        />
      </div>
    );
  },
);
