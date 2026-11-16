import type { QueryClient } from "@tanstack/react-query";
import { store } from "@/lib/store/store";

/** Tenant/user transitions discard prior server state; token renewal retains it. */
export function subscribeAuthQueryBoundary(queryClient: QueryClient) {
  let version = store.getState().auth.contextVersion;
  return store.subscribe(() => {
    const next = store.getState().auth.contextVersion;
    if (next === version) return;
    version = next;
    // clear() cancels active queries and removes queries/mutations, including unscoped legacy keys.
    queryClient.clear();
  });
}
