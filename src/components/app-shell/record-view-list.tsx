import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function RecordViewList({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("space-y-3", className)} {...props} />;
}

export function RecordViewListItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("min-w-0 overflow-hidden rounded-lg border border-border/60 bg-background", className)}
      {...props}
    />
  );
}
