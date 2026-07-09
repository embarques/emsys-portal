export type RecipientType = "customer" | "vendor" | "branch" | "internal";

export type InventoryRecipient = {
  id: string;
  name: string;
  type: RecipientType;
  contactInfo?: string;
  address?: string;
  createdAt: string;
};

export type RecipientFormValues = {
  name: string;
  type: RecipientType;
  contactInfo: string;
  address: string;
};

export type RecipientFilterState = {
  query: string;
  type: RecipientType | "all";
};

export const RECIPIENT_TYPES: { value: RecipientType; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "branch", label: "Branch" },
  { value: "internal", label: "Internal" },
];

export function createEmptyRecipientForm(): RecipientFormValues {
  return {
    name: "",
    type: "customer",
    contactInfo: "",
    address: "",
  };
}
