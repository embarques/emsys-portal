"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchInvoices } from "@/lib/invoices/api/invoices-api";
import {
  buildSenderPendingInvoiceParams,
  selectInvoicesWithBalance,
} from "@/lib/invoices/sender-pending-invoices";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

/** Invoices with an outstanding balance for one sender, newest first. */
export function useSenderPendingInvoices(
  senderId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const { companyId, hasPermission } = useAuth();
  const canViewInvoices = hasPermission(PERMISSIONS.invoicesView.name, PERMISSIONS.invoicesView.resourceType);
  const id = senderId?.trim() ?? "";
  const params = buildSenderPendingInvoiceParams(id);

  const query = useWorkspaceQuery({
    queryKey: [...queryKeys.invoices.list(params), companyId],
    queryFn: ({ signal }) => fetchInvoices(params, signal),
    select: (result) => selectInvoicesWithBalance(result.items),
    enabled: enabled && canViewInvoices && Boolean(companyId) && id.length > 0,
  });

  return { ...query, canViewInvoices };
}
