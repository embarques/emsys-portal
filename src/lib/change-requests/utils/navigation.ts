import type { ChangeResource } from "../api";

export function changeRequestHref(resourceType: ChangeResource, resourceId: string): string {
  return `/change-requests?${new URLSearchParams({ resourceType, resourceId })}`;
}
