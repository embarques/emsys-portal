import * as React from "react";

import { cn } from "@/lib/utils";

/** Keep field titles and inline New/Edit actions the same height. */
export const fieldHeadingClassName = "min-h-7 py-1 leading-5";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70", fieldHeadingClassName, className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Label };
