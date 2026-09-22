"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { CustomerFormWorkspace } from "@/components/customers/customer-form-workspace";
import { CUSTOMER_FORM_PARAM } from "@/lib/customers/customer-form-navigation";
import { WorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { closeWorkspaceTab, hydrateWorkspaceTabs, readPersistedWorkspaceTabs } from "@/lib/store/layout/tabs-slice";

/** A full workspace replacement, with the originating form kept mounted for return. */
export function MobileCustomerFormWorkspace({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const formId = searchParams.get(CUSTOMER_FORM_PARAM);
  const tab = useAppSelector((state) => state.layoutTabs.tabs.find((entry) => entry.id === formId));
  const form = tab?.form?.feature === "customers" ? tab.form : null;
  const dispatch = useAppDispatch();
  const previousFormId = useRef<string | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!formId || tab) return;
    const persisted = readPersistedWorkspaceTabs();
    if (persisted?.tabs.some((entry) => entry.id === formId)) {
      dispatch(hydrateWorkspaceTabs(persisted));
    }
  }, [dispatch, formId, tab]);

  useEffect(() => {
    const previous = previousFormId.current;
    previousFormId.current = formId;
    // Browser Back also cancels the customer edit and releases pending party returns.
    if (previous && previous !== formId) dispatch(closeWorkspaceTab(previous));
  }, [dispatch, formId]);

  return (
    <>
      <div hidden={Boolean(form)} inert={Boolean(form)}>
        <WorkspaceTabScope tabId="mobile-page" isActive={!form} portalContainer={portalContainer}>
          {children}
          <div ref={setPortalContainer} className="pointer-events-none fixed inset-0 z-50 [&:not(:empty)]:pointer-events-auto" />
        </WorkspaceTabScope>
      </div>
      {form && tab ? (
        <CustomerFormWorkspace
          key={tab.id}
          tabId={tab.id}
          mode={form.mode}
          entityId={form.entityId}
          customerType={form.customerType}
          customerFormIntent={form.customerFormIntent}
        />
      ) : null}
    </>
  );
}
