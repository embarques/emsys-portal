export type RecordPhoneType = "mobile" | "business" | "home" | "other";

export type RecordPhone = {
  type: RecordPhoneType;
  /** Normalized E.164 value stored by the API (e.g. +13055551000). */
  number: string;
  /** Response-only formatted value from the API (e.g. (305) 555-1000). Ignored on write. */
  displayNumber?: string;
  isPrimary: boolean;
};

/** Payload shape sent to the API on create/update — displayNumber is omitted. */
export type RecordPhoneWritePayload = Pick<RecordPhone, "type" | "number" | "isPrimary">;

export const RECORD_PHONE_TYPE_OPTIONS: { value: RecordPhoneType; label: string }[] = [
  { value: "mobile", label: "Mobile" },
  { value: "business", label: "Business" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];
