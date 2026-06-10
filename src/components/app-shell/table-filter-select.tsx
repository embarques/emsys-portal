"use client";

import { cn } from "@/lib/utils";

const baseClassName =
  "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

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
  placeholderDisabled?: boolean;
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
  placeholderDisabled = true,
  className,
  mutedWhenEmpty = false,
}: TableFilterSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      className={cn(baseClassName, mutedWhenEmpty && !value && "text-muted-foreground", className)}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder ? (
        <option value="" disabled={placeholderDisabled}>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
