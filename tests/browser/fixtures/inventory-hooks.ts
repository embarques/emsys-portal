export function useInventoryItems() { return { data: [], isFetching: false }; }
export function useInventorySuppliers() { return { data: [], isFetching: false }; }
const mutation = () => ({ isPending: false, mutateAsync: async () => ({}) });
export const useCreateSupplier = mutation;
export const useUpdateSupplier = mutation;
export const useCreateEmployee = mutation;
export const useUpdateEmployee = mutation;
