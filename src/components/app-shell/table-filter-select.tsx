"use client";

import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";

const baseClassName =
  "h-9 min-w-0 flex-1 rounded-md border border-input bg-background text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

type TableFilterSelectOption = {
  value: string;
  label: string;
};

type TableFilterSelectProps = {
  "aria-label": string;
  value: string;
  onChange: (value: string) => void;
  options: TableFilterSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  mutedWhenEmpty?: boolean;
};

export function tableFilterSelectClassName(className?: string) {
  return cn(baseClassName, className);
}

export function TableFilterSelect({
  "aria-label": ariaLabel,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  className,
  mutedWhenEmpty = false,
}: TableFilterSelectProps) {
  return (
    <SearchableSelect
      aria-label={ariaLabel}
      value={value}
      onValueChange={onChange}
      options={options}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(baseClassName, mutedWhenEmpty && !value && "text-muted-foreground", className)}
      contentClassName="z-[110]"
    />
  );
}
