export type RecordPhoneType = "mobile" | "business" | "home" | "other";

export type RecordPhone = {
  type: RecordPhoneType;
  number: string;
  isPrimary: boolean;
};

export const RECORD_PHONE_TYPE_OPTIONS: { value: RecordPhoneType; label: string }[] = [
  { value: "mobile", label: "Mobile" },
  { value: "business", label: "Business" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];
