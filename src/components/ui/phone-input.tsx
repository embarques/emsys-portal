"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatPhoneForDisplay, normalizeStoredPhone } from "@/lib/utils/phone";

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange" | "inputMode"> & {
  value: string;
  onChange: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder = "+1 201-555-1234", ...props }, ref) => {
    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      onChange(normalizeStoredPhone(event.target.value));
    }

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={formatPhoneForDisplay(value)}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
