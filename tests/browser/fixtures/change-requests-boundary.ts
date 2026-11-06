import { useQuery } from "@tanstack/react-query";

type Probe = { url: string; body?: unknown };
type FixtureState = {
  changeCalls?: Probe[];
  failChange?: boolean;
  denyRequest?: boolean;
  targetVersion?: string;
  viewerOnly?: boolean;
  reviewer?: boolean;
  staleReview?: boolean;
};
const state = () => window as unknown as FixtureState;
const permissions = ["canCreateChangeRequest", "canViewChangeRequest"].map(name => ({ name, resourceType: "change_request" }));
export function useAuth() {
  return { companyId: "company-a", user: { uid: "employee-1" }, roleId: 3, permissions,
    loading: false, roleLoading: false,
    hasPermission: (name: string) => name === "canViewChangeRequest" ||
      name === "canCreateChangeRequest" && !state().viewerOnly || name === "canApproveChangeRequest" && Boolean(state().reviewer),
  };
}
export function useSearchParams() { return new URLSearchParams("resourceType=pickup&resourceId=record-1"); }
export function useTranslation() { return { t: (key: string) => key }; }
export function useAppSelector<T>(select: (value: { auth: { idToken: string; companyId: string } }) => T): T {
  return select({ auth: { idToken: "fixture-token", companyId: "company-a" } });
}
export const store = { getState: () => ({ auth: { companyId: "company-a" } }) };
export const useWorkspaceQuery = useQuery;
export function normalizeApiError(error: unknown) { return { message: error instanceof Error ? error.message : String(error) }; }
const row = { id: "request-1", resourceType: "pickup", resourceId: "record-1", action: "UPDATE", reason: "Please correct", status: "PENDING", createdAt: "2026-11-05T12:00:00Z", requestedBy: { id: 1, name: "Employee" }, proposedChanges: { purpose: "TAKE" } };
export const apiClient = {
  async get(url: string) {
    (state().changeCalls ??= []).push({ url });
    if (url.startsWith("/change-requests/target")) {
      const params = new URL(url, "http://emsys.test").searchParams;
      return { data: { resourceType: params.get("resourceType"), resourceId: params.get("resourceId"), version: state().targetVersion ?? "version-1", allowedActions: { request_update: !state().denyRequest, request_void: true } } };
    }
    return { data: state().reviewer ? [row] : [], total: state().reviewer ? 1 : 0 };
  },
  async post(url: string, body: unknown) {
    (state().changeCalls ??= []).push({ url, body });
    await new Promise(resolve => setTimeout(resolve, 40));
    if (state().failChange && url === "/change-requests") { state().failChange = false; throw new Error("Ambiguous network failure"); }
    if (state().staleReview && url.endsWith("/approve")) throw new Error("Source record changed; review again");
    return { data: row };
  },
};
