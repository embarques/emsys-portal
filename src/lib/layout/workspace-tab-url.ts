import { WORKSPACE_TAB_PARAM } from "@/lib/layout/workspace-tab-types";

export function buildWorkspaceTabUrl(href: string, tabId: string): string {
  const [pathname, existingSearch = ""] = href.split("?");
  const params = new URLSearchParams(existingSearch);
  params.set(WORKSPACE_TAB_PARAM, tabId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function readWorkspaceTabId(searchParams: URLSearchParams | string | null | undefined): string | null {
  if (!searchParams) return null;
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const tabId = params.get(WORKSPACE_TAB_PARAM)?.trim();
  return tabId || null;
}

export function stripWorkspaceTabParam(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.delete(WORKSPACE_TAB_PARAM);
  return next;
}
