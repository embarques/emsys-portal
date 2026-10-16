import * as React from "react";

import { cn } from "@/lib/utils";

/** Keep field titles and inline New/Edit actions the same height without extra vertical padding (so space-y gaps stay even). */
export const fieldHeadingClassName = "flex min-h-7 items-center leading-5";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        fieldHeadingClassName,
        className,
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
