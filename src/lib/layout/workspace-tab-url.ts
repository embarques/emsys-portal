import { WORKSPACE_TAB_PARAM } from "@/lib/layout/workspace-tab-types";

export function pathnameFromHref(href: string): string {
  return href.split("?")[0] ?? href;
}

export function buildWorkspaceTabUrl(href: string, tabNumber: number): string {
  const [pathname, existingSearch = ""] = href.split("?");
  const params = new URLSearchParams(existingSearch);
  params.set(WORKSPACE_TAB_PARAM, String(tabNumber));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function readWorkspaceTabNumber(
  searchParams: URLSearchParams | string | null | undefined,
): number | null {
  if (!searchParams) return null;
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const raw = params.get(WORKSPACE_TAB_PARAM)?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;

  const tabNumber = Number(raw);
  return Number.isInteger(tabNumber) && tabNumber > 0 ? tabNumber : null;
}

export function stripWorkspaceTabParam(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.delete(WORKSPACE_TAB_PARAM);
  return next;
}
