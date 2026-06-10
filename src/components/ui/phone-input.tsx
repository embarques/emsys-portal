"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatPhoneDisplay, normalizeStoredPhone } from "@/lib/utils/phone";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "555-123-4567", maxLength = 12, ...props }, ref) => {
    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      onChange(normalizeStoredPhone(event.target.value));
    }

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={placeholder}
        maxLength={maxLength}
        value={formatPhoneDisplay(value)}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
