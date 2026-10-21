import type { Customer } from "@/lib/customers/types";
import { CUSTOMER_TYPE_RECEIVER } from "@/lib/customers/types";
import { customer as sender } from "./customers";

export * from "./customers";

const receiver = (id: string, name: string, city: string) =>
  ({ ...sender, id, name, customerType: CUSTOMER_TYPE_RECEIVER,
    addresses: sender.addresses.map((address) => ({ ...address, city })) }) as Customer;

export const pickupReceivers = {
  maria: receiver("receiver-maria", "Maria Receiver", "Santo Domingo"),
  jose: receiver("receiver-jose", "Jose Receiver", "Santiago"),
};

const customersById = new Map<string, Customer>(
  [sender, ...Object.values(pickupReceivers)].map((entry) => [entry.id, entry]),
);

export function useEnsureCustomerDetail() {
  return async (id: string) => customersById.get(id) ?? sender;
}
