import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DateInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    return (
      <div className="relative">
        <button
          type="button"
          aria-label="Open date picker"
          tabIndex={-1}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => inputRef.current?.showPicker?.()}
        >
          <CalendarDays className="size-4" />
        </button>
        <Input
          ref={inputRef}
          type="date"
          className={cn(
            "pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
