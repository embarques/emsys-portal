import { createDefaultRecordPhones } from "@/lib/phones/phones";
import type { RecordPhone } from "@/lib/phones/types";

export type InventorySupplier = {
  id: string;
  companyName: string;
  contactNames: string[];
  addresses: string[];
  phones: RecordPhone[];
  emails: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type SupplierFormValues = {
  companyName: string;
  contactNames: string[];
  addresses: string[];
  phones: RecordPhone[];
  emails: string[];
};

export type SupplierFilterState = {
  query: string;
};

export function createEmptySupplierForm(): SupplierFormValues {
  return {
    companyName: "",
    contactNames: [""],
    addresses: [""],
    phones: createDefaultRecordPhones(),
    emails: [""],
  };
}

export function supplierToFormValues(supplier: InventorySupplier): SupplierFormValues {
  return {
    companyName: supplier.companyName,
    contactNames: supplier.contactNames.length > 0 ? [...supplier.contactNames] : [""],
    addresses: supplier.addresses.length > 0 ? [...supplier.addresses] : [""],
    phones: supplier.phones.length > 0 ? supplier.phones.map((phone) => ({ ...phone })) : createDefaultRecordPhones(),
    emails: supplier.emails.length > 0 ? [...supplier.emails] : [""],
  };
}

export function compactStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
