import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { keepPreviousData, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { store } from "@/lib/store/store";
import { authBoundary } from "./auth-context-boundary";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let pendingRefresh: Promise<string | null> | null = null;
let pendingLogout: Promise<void> | null = null;
let pendingDevLogin: Promise<string> | null = null;
function Inspect() {
  const auth = useAuth();
  const rows = useQuery({ queryKey: ["invoices"], queryFn: () => new Promise<string>(() => {}), placeholderData: keepPreviousData });
  useEffect(() => {
    Object.assign(window, { authContextTest: { ...authBoundary,
      signOut: auth.signOut,
      startLogout: () => { pendingLogout = auth.signOut(); },
      finishLogout: async () => { authBoundary.releaseLogout(); await pendingLogout; },
      signInDev: auth.signInWithDevSession,
      startDelayedDevLogin: () => {
        pendingDevLogin = auth.signInWithDevSession({ email: "delayed@fixture.test", password: "fixture", companyId: "company-b" })
          .then(() => "success", (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "ERR_CANCELED" ? "canceled" : "error");
      },
      finishDelayedDevLogin: async () => { authBoundary.releaseDevLogin(); return pendingDevLogin; },
      startRefresh: () => { pendingRefresh = auth.refreshToken(); },
      releaseRefresh: async () => { authBoundary.releaseRefresh(); await pendingRefresh; },
      setData: (value: string) => client.setQueryData(["invoices"], value),
      readData: () => client.getQueryData(["invoices"]) ?? null,
      state: () => store.getState().auth,
    } });
  }, [auth]);
  return <><span id="invoice-data">{rows.data ?? "empty"}</span><output id="auth-status" data-ready={!auth.loading && !auth.roleLoading}>
    {JSON.stringify({ actorId: auth.user?.uid ?? null, companyId: auth.companyId, authenticated: auth.isAuthenticated })}
  </output></>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>
  <Provider store={store}><AuthProvider><Inspect /></AuthProvider></Provider>
</QueryClientProvider>);
