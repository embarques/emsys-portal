"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { fetchCustomerById } from "@/lib/customers/api/customers-api";
import type { Customer } from "@/lib/customers/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { queryKeys } from "@/lib/query/query-keys";

type PartySide = "sender" | "receiver";

type PendingPartyEdit = {
  side: PartySide;
  customerId: string;
};

/**
 * After Edit sender/receiver opens a customer form tab, apply the saved customer
 * back onto the parent appointment/invoice form when that edit tab closes.
 */
export function useApplyCustomerOnTabReturn(
  apply: (side: PartySide, customer: Customer) => void,
) {
  const isActive = useWorkspaceTabScope()?.isActive ?? true;
  const { tabs } = useWorkspaceTabs();
  const queryClient = useQueryClient();
  const pendingRef = useRef<PendingPartyEdit[]>([]);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const markPendingPartyEdit = useCallback((side: PartySide, customerId: string) => {
    pendingRef.current = [
      ...pendingRef.current.filter((entry) => entry.side !== side),
      { side, customerId },
    ];
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const stillOpen: PendingPartyEdit[] = [];
    const closed: PendingPartyEdit[] = [];

    for (const pending of pendingRef.current) {
      const editTabStillOpen = tabs.some(
        (tab) =>
          tab.form?.feature === "customers" &&
          tab.form.mode === "edit" &&
          tab.form.entityId === pending.customerId,
      );
      if (editTabStillOpen) {
        stillOpen.push(pending);
      } else {
        closed.push(pending);
      }
    }

    if (closed.length === 0) return;

    pendingRef.current = stillOpen;

    void Promise.all(
      closed.map(async (pending) => {
        const customer = await queryClient.fetchQuery({
          queryKey: queryKeys.customers.detail(pending.customerId),
          queryFn: () => fetchCustomerById(pending.customerId),
        });
        applyRef.current(pending.side, customer);
      }),
    ).catch(() => undefined);
  }, [isActive, queryClient, tabs]);

  return markPendingPartyEdit;
}
