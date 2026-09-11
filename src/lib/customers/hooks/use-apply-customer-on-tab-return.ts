"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { fetchCustomerById } from "@/lib/customers/api/customers-api";
import { consumePartyReturnCustomerId } from "@/lib/customers/party-customer-return";
import type { Customer } from "@/lib/customers/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { queryKeys } from "@/lib/query/query-keys";

type PartySide = "sender" | "receiver";

type PendingPartyReturn =
  | {
      side: PartySide;
      mode: "edit";
      customerId: string;
    }
  | {
      side: PartySide;
      mode: "add";
      customerType: number;
    };

export type ApplyCustomerOnTabReturnMeta = {
  mode: "add" | "edit";
};

/**
 * After New/Edit sender/receiver opens a customer form tab, apply the saved
 * customer back onto the parent appointment/invoice form when that tab closes.
 */
export function useApplyCustomerOnTabReturn(
  apply: (side: PartySide, customer: Customer, meta: ApplyCustomerOnTabReturnMeta) => void,
) {
  const isActive = useWorkspaceTabScope()?.isActive ?? true;
  const { tabs } = useWorkspaceTabs();
  const queryClient = useQueryClient();
  const pendingRef = useRef<PendingPartyReturn[]>([]);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const markPendingPartyEdit = useCallback((side: PartySide, customerId: string) => {
    pendingRef.current = [
      ...pendingRef.current.filter((entry) => entry.side !== side),
      { side, mode: "edit", customerId },
    ];
  }, []);

  const markPendingPartyAdd = useCallback((side: PartySide, customerType: number) => {
    pendingRef.current = [
      ...pendingRef.current.filter((entry) => entry.side !== side),
      { side, mode: "add", customerType },
    ];
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const stillOpen: PendingPartyReturn[] = [];
    const closed: PendingPartyReturn[] = [];

    for (const pending of pendingRef.current) {
      const tabStillOpen =
        pending.mode === "edit"
          ? tabs.some(
              (tab) =>
                tab.form?.feature === "customers" &&
                tab.form.mode === "edit" &&
                tab.form.entityId === pending.customerId,
            )
          : tabs.some(
              (tab) =>
                tab.form?.feature === "customers" &&
                tab.form.mode === "add" &&
                tab.form.customerType === pending.customerType,
            );

      if (tabStillOpen) {
        stillOpen.push(pending);
      } else {
        closed.push(pending);
      }
    }

    if (closed.length === 0) return;

    pendingRef.current = stillOpen;

    void Promise.all(
      closed.map(async (pending) => {
        const customerId =
          pending.mode === "edit" ? pending.customerId : consumePartyReturnCustomerId();
        if (!customerId) return;

        const customer = await queryClient.fetchQuery({
          queryKey: queryKeys.customers.detail(customerId),
          queryFn: () => fetchCustomerById(customerId),
        });
        applyRef.current(pending.side, customer, { mode: pending.mode });
      }),
    ).catch(() => undefined);
  }, [isActive, queryClient, tabs]);

  return { markPendingPartyEdit, markPendingPartyAdd };
}
