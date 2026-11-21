import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DateInputProps = React.ComponentProps<"input"> & {
  /** Size to the date value instead of stretching to full width. */
  fitContent?: boolean;
};

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, style, fitContent = false, ...props }, forwardedRef) => {
    const { t } = useTranslation();
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    return (
      <div
        className={cn(
          "relative min-w-0",
          fitContent ? "w-auto max-w-full shrink-0" : "w-full max-w-full",
        )}
      >
        <button
          type="button"
          aria-label={t("common.ui.openDatePicker")}
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
            "block min-w-0 appearance-none leading-normal",
            "[&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-0",
            "[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden",
            fitContent
              ? cn(
                  // Native date inputs ignore field-sizing; size to icon gutter + date glyphs.
                  "max-w-full !w-[calc(2rem+9.5ch)] !min-w-0 !pl-8 !pr-1.5",
                  "[&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:w-auto [&::-webkit-datetime-edit]:max-w-full [&::-webkit-datetime-edit]:p-0",
                  "[&::-webkit-datetime-edit-fields-wrapper]:p-0",
                  "[&::-webkit-datetime-edit-text]:px-0",
                  "[&::-webkit-datetime-edit-month-field]:p-0 [&::-webkit-datetime-edit-day-field]:p-0 [&::-webkit-datetime-edit-year-field]:p-0",
                  "[&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
                )
              : cn(
                  "w-full max-w-full pl-9 [inline-size:100%] [max-inline-size:100%] [min-inline-size:0]",
                  "[&::-webkit-date-and-time-value]:text-left",
                ),
            className,
          )}
          style={
            fitContent
              ? {
                  width: "calc(2rem + 9.5ch)",
                  minWidth: 0,
                  maxWidth: "100%",
                  minInlineSize: 0,
                  maxInlineSize: "100%",
                  inlineSize: "calc(2rem + 9.5ch)",
                  ...style,
                }
              : {
                  minInlineSize: 0,
                  maxInlineSize: "100%",
                  inlineSize: "100%",
                  ...style,
                }
          }
          {...props}
        />
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };
