import type { ApiTableRecord } from "@/lib/table/api-table-fields";

import type { InventoryAuditFields, InventoryVersioned } from "./common";

export type InventorySupplierContact = {
  name: string;
  phone: string;
  email: string;
};

/** Supply vendor (`inventory.Supplier`). */
export type InventorySupplier = ApiTableRecord &
  InventoryAuditFields &
  InventoryVersioned & {
    id: string;
    companyName: string;
    contacts: InventorySupplierContact[];
    addresses: string[];
    isActive: boolean;
  };

export type SupplierFormValues = {
  companyName: string;
  contacts: InventorySupplierContact[];
  addresses: string[];
};

export type SupplierFilterState = {
  query: string;
};

export function createEmptySupplierContact(): InventorySupplierContact {
  return { name: "", phone: "", email: "" };
}

export function createEmptySupplierForm(): SupplierFormValues {
  return {
    companyName: "",
    contacts: [createEmptySupplierContact()],
    addresses: [""],
  };
}

export function supplierToFormValues(supplier: InventorySupplier): SupplierFormValues {
  return {
    companyName: supplier.companyName,
    contacts:
      supplier.contacts.length > 0
        ? supplier.contacts.map((contact) => ({ ...contact }))
        : [createEmptySupplierContact()],
    addresses: supplier.addresses.length > 0 ? [...supplier.addresses] : [""],
  };
}

export function compactStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function compactSupplierContacts(contacts: InventorySupplierContact[]): InventorySupplierContact[] {
  return contacts
    .map((contact) => ({
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      email: contact.email.trim(),
    }))
    .filter((contact) => contact.name || contact.phone || contact.email);
}
