"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { findHeldInvoiceNumber, manageInvoicePool } from "@/lib/invoices/api/invoice-pool-api";
import { lockInvoiceNumberDraft } from "@/lib/invoices/invoice-draft-number";
import type { InvoiceReservationProof } from "@/lib/invoices/types";

export function useInvoiceDraftNumber() {
  const { companyId, user } = useAuth();
  const cache = useQueryClient();
  const current = useRef<Awaited<ReturnType<typeof lockInvoiceNumberDraft>> | null>(null);
  const scope = JSON.stringify([companyId, user?.uid]);
  const mountedScope = useRef<string | null>(scope);
  useEffect(() => {
    mountedScope.current = scope;
    return () => {
      mountedScope.current = null;
      current.current?.unlock();
      current.current = null;
    };
  }, [scope]);

  function finish() {
    current.current?.forget();
    current.current = null;
  }

  const reserve = useMutation({
    mutationFn: async () => {
      if (!companyId || !user?.uid) throw new Error("Sign in to reserve an invoice number.");
      while (mountedScope.current === scope) {
        const draft = current.current ?? await lockInvoiceNumberDraft(scope);
        if (mountedScope.current !== scope) { draft.unlock(); break; }
        current.current = draft;
        const [item] = await manageInvoicePool({
          action: "reserve-draft", count: 1, requestId: draft.id, deviceId: draft.id,
        });
        if (mountedScope.current !== scope) break;
        if (draft.recovering) {
          // A prior save or discard may have committed before its response arrived.
          const active = await findHeldInvoiceNumber(draft.id);
          if (mountedScope.current !== scope) break;
          if (!active || active.id !== item?.id) { finish(); continue; }
        }
        if (!item?.allocation.token) throw new Error("The API did not confirm the invoice number.");
        return {
          invoiceNumber: item.number, generatedInvoiceNumber: item.number,
          reservation: { id: item.id, token: item.allocation.token, deviceId: draft.id },
        };
      }
      throw new Error("Invoice session changed.");
    },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["invoice-pool", companyId] }); },
  });

  const release = useMutation({
    mutationFn: async (proof: InvoiceReservationProof) => {
      const draft = current.current;
      if (!draft || draft.id !== proof.deviceId) throw new Error("Invoice session changed.");
      await manageInvoicePool({
        action: "release-draft", deviceId: draft.id, requestId: draft.releaseRequestId,
        items: [{ id: proof.id, token: proof.token }],
      });
      if (current.current === draft) finish();
    },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["invoice-pool", companyId] }); },
  });
  return { reserve, release, finish, hasDraft: () => Boolean(current.current) };
}
