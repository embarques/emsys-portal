import { customer as sender } from "./customers";
import { pickupReceivers } from "./invoice-form-customers";

const idle = { data: undefined, isFetching: false, isLoading: false };
const mutation = () => ({ isPending: false, mutateAsync: async () => ({}) });

const employees = [
  { id: 1, name: "Ana Warehouse", active: true, department: "warehouse", title: "", branch: { id: 1, code: "NY", name: "New York" } },
  { id: 2, name: "Luis Office", active: true, department: "office", title: "", branch: { id: 1, code: "NY", name: "New York" } },
];

const routes = [
  { id: "route-1", name: "North route", date: "2026-10-21", createdAt: "2026-10-19T09:00:00Z", route: { id: "r1", routeId: "R1", name: "North route" }, employees: [], branch: { code: "NY" } },
  { id: "route-2", name: "South route", date: "2026-10-20", createdAt: "2026-10-20T15:30:00Z", route: { id: "r2", routeId: "R2", name: "South route" }, employees: [], branch: { code: "NY" } },
];

const branches = { items: [{ id: 1, code: "NY", name: "New York", type: "office", active: true }] };
export function useBranchPicker() { return { data: branches, isLoading: false }; }

export function useEmployees() { return { data: { items: employees }, isFetching: false }; }
export function useEmployeeSearch() { return { data: { items: employees }, isFetching: false }; }
export const useCreateEmployee = mutation;
export function useEnsureEmployeeDetail() {
  return async (id: string) => employees.find((employee) => String(employee.id) === id) ?? employees[0];
}
export const useUpdateEmployee = mutation;

export function useActiveRoutePicker() { return { data: { items: routes }, isFetching: false }; }
export function useEnsurePickupRouteDetail() {
  return async (id: string) => routes.find((route) => route.id === id) ?? routes[0];
}

export function useContainerPicker() { return { data: { items: [{ id: 7, name: "CONT-7" }] }, isFetching: false }; }
export const useCreateContainer = mutation;

const catalogItems = [
  { itemId: "item-old", description: "Small box", price: 25, createdAt: "2026-09-01T10:00:00Z" },
  { itemId: "item-new", description: "Flat screen TV", price: 120, createdAt: "2026-10-20T10:00:00Z" },
];
export function useItemPicker() { return { data: { items: catalogItems }, isFetching: false }; }

const orders = [
  { id: 101, sender, receivers: [pickupReceivers.maria] },
  { id: 102, sender, receivers: [pickupReceivers.maria, pickupReceivers.jose] },
];

export function useOrders() { return { data: { items: orders }, isFetching: false }; }
export function useOrder(id: string | null) {
  const order = orders.find((entry) => String(entry.id) === id);
  return order ? { data: order, isFetching: false, isLoading: false } : idle;
}
export function useOrderSearch() { return { data: { items: [] }, isFetching: false }; }
