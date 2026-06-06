import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type ClientType = "sender" | "receiver";

export type CustomerPhone = {
  id: string;
  number: string;
  label?: string;
};

export type CustomerAddress = {
  id: string;
  streetAddress: string;
  apt?: string;
  crossStreet?: string;
  city: string;
  state?: string;
  provinceCountry?: string;
  zipCode?: string;
  isPrimary: boolean;
};

export type Customer = {
  clientId: string;
  clientType: ClientType;
  name: string;
  documentId?: string;
  phones: CustomerPhone[];
  email?: string;
  notes?: string;
  addresses: CustomerAddress[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type CustomerPhoneFormValues = {
  id: string;
  number: string;
  label: string;
};

export type CustomerAddressFormValues = {
  id: string;
  streetAddress: string;
  apt: string;
  crossStreet: string;
  city: string;
  state: string;
  provinceCountry: string;
  zipCode: string;
  isPrimary: boolean;
};

export type CustomerFormValues = {
  clientId: string;
  clientType: ClientType;
  name: string;
  documentId: string;
  phones: CustomerPhoneFormValues[];
  email: string;
  notes: string;
  addresses: CustomerAddressFormValues[];
  createdBy: string;
};

export type CustomerFilterState = {
  query: string;
  clientType: ClientType | "all";
};

export const CLIENT_TYPES: { value: ClientType; label: string }[] = [
  { value: "sender", label: "Sender" },
  { value: "receiver", label: "Receiver" },
];

export function createRecordId(): string {
  return crypto.randomUUID();
}

export function createCustomerId(): string {
  return createRecordId();
}

export function createEmptyPhone(): CustomerPhoneFormValues {
  return { id: createRecordId(), number: "", label: "" };
}

export function createEmptyAddress(isPrimary = false): CustomerAddressFormValues {
  return {
    id: createRecordId(),
    streetAddress: "",
    apt: "",
    crossStreet: "",
    city: "",
    state: "",
    provinceCountry: "",
    zipCode: "",
    isPrimary,
  };
}

export function createEmptyCustomerForm(): CustomerFormValues {
  return {
    clientId: createCustomerId(),
    clientType: "sender",
    name: "",
    documentId: "",
    phones: [createEmptyPhone()],
    email: "",
    notes: "",
    addresses: [createEmptyAddress(true)],
    createdBy: DEFAULT_CREATED_BY,
  };
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    clientId: customer.clientId,
    clientType: customer.clientType,
    name: customer.name,
    documentId: customer.documentId ?? "",
    phones:
      customer.phones.length > 0
        ? customer.phones.map((phone) => ({
            id: phone.id,
            number: phone.number,
            label: phone.label ?? "",
          }))
        : [createEmptyPhone()],
    email: customer.email ?? "",
    notes: customer.notes ?? "",
    addresses:
      customer.addresses.length > 0
        ? customer.addresses.map((address) => ({
            id: address.id,
            streetAddress: address.streetAddress,
            apt: address.apt ?? "",
            crossStreet: address.crossStreet ?? "",
            city: address.city,
            state: address.state ?? "",
            provinceCountry: address.provinceCountry ?? "",
            zipCode: address.zipCode ?? "",
            isPrimary: address.isPrimary,
          }))
        : [createEmptyAddress(true)],
    createdBy: customer.createdBy,
  };
}

function normalizePhones(phones: CustomerPhoneFormValues[]): CustomerPhone[] {
  return phones
    .map((phone) => ({
      id: phone.id,
      number: phone.number.trim(),
      label: phone.label.trim() || undefined,
    }))
    .filter((phone) => phone.number.length > 0);
}

function normalizeAddresses(addresses: CustomerAddressFormValues[]): CustomerAddress[] {
  const cleaned = addresses
    .map((address) => ({
      id: address.id,
      streetAddress: address.streetAddress.trim(),
      apt: address.apt.trim() || undefined,
      crossStreet: address.crossStreet.trim() || undefined,
      city: address.city.trim(),
      state: address.state.trim() || undefined,
      provinceCountry: address.provinceCountry.trim() || undefined,
      zipCode: address.zipCode.trim() || undefined,
      isPrimary: address.isPrimary,
    }))
    .filter((address) => address.streetAddress || address.city);

  if (cleaned.length === 0) return [];

  const primaryIndex = cleaned.findIndex((address) => address.isPrimary);
  return cleaned.map((address, index) => ({
    ...address,
    isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
  }));
}

export function formValuesToCustomer(
  values: CustomerFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Customer {
  const phones = normalizePhones(values.phones);
  const addresses = normalizeAddresses(values.addresses);

  if (phones.length === 0) {
    throw new Error("At least one phone number is required.");
  }

  if (addresses.length === 0) {
    throw new Error("At least one address with street and city is required.");
  }

  return {
    clientId: values.clientId,
    clientType: values.clientType,
    name: values.name.trim(),
    documentId: values.documentId.trim() || undefined,
    phones,
    email: values.email.trim() || undefined,
    notes: values.notes.trim() || undefined,
    addresses,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function getPrimaryAddress(customer: Customer): CustomerAddress | undefined {
  return customer.addresses.find((address) => address.isPrimary) ?? customer.addresses[0];
}
