"use client";

import { useCallback, useEffect, useRef } from "react";

import { consumeFormTabCreatedId } from "@/lib/layout/form-tab-return";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";

/**
 * After a "New" action opens an add tab with `closeOnSave`, apply the created
 * record id back onto the opener once that tab closes.
 */
export function useApplyCreatedOnTabReturn(apply: (feature: string, id: string) => void) {
  const isActive = useWorkspaceTabScope()?.isActive ?? true;
  const { tabs } = useWorkspaceTabs();
  const pendingRef = useRef<string[]>([]);
  const applyRef = useRef(apply);

  useEffect(() => {
    applyRef.current = apply;
  });

  const markPendingAdd = useCallback((feature: string) => {
    pendingRef.current = [...pendingRef.current.filter((entry) => entry !== feature), feature];
  }, []);

  useEffect(() => {
    if (!isActive || pendingRef.current.length === 0) return;

    const closed = pendingRef.current.filter(
      (feature) =>
        !tabs.some(
          (tab) =>
            tab.form?.feature === feature && tab.form.mode === "add" && tab.form.closeOnSave,
        ),
    );
    if (closed.length === 0) return;

    pendingRef.current = pendingRef.current.filter((feature) => !closed.includes(feature));
    for (const feature of closed) {
      const id = consumeFormTabCreatedId(feature);
      if (id) applyRef.current(feature, id);
    }
  }, [isActive, tabs]);

  return { markPendingAdd };
}
