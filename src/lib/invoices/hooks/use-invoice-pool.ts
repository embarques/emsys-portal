"use client";

import { useDeferredValue, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { fetchUsers } from "@/lib/users/api/users-api";
import { isAxiosError } from "axios";
import { normalizeApiError } from "@/lib/api/axios";
import { fetchInvoicePool, manageInvoicePool } from "@/lib/invoices/api/invoice-pool-api";
import { invoicePoolFormSchema, type InvoicePoolForm, type InvoicePoolAction, type ReservedInvoice } from "@/lib/invoices/schemas/invoice-pool.schema";

export function useInvoicePool() {
  const { companyId, user, email, hasPermission, loading, roleLoading } = useAuth();
  const transport = useAppSelector(state => state.auth);
  const queryClient = useQueryClient();
  const canView = hasPermission("canViewInvoicePool", "invoice_pool");
  const canGenerate = hasPermission("canGenerateInvoicePool", "invoice_pool");
  const canViewUsers = hasPermission("canViewUser", "user");
  const canAssign = hasPermission("canAssignInvoicePool", "invoice_pool");
  const ready = !loading && !roleLoading && !!companyId && !!transport.idToken && transport.companyId === companyId;
  const [filter, setFilter] = useState("all");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [selection, setSelection] = useState<ReservedInvoice[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const search = useDeferredValue(userSearch);
  const actor = user?.uid ?? email ?? "anonymous";
  const key = `invoice-pool-action:${companyId}:${actor}`;
  const [pending, setPending] = useState<{ key: string; action: InvoicePoolAction } | null>(() => {
    if(typeof window === "undefined") return null;
    const stored=sessionStorage.getItem(key);
    if(!stored) return null;
    try{return {key,action:JSON.parse(stored)};}catch{return null;}
  });
  const form = useForm<InvoicePoolForm>({ resolver: zodResolver(invoicePoolFormSchema), defaultValues: { count: 50, userId: 0 } });
  const queryKey = ["invoice-pool", companyId, actor, filter, cursors.at(-1)];
  const query = useWorkspaceQuery({ queryKey, enabled: ready && canView,
    queryFn: ({ signal }) => fetchInvoicePool(filter === "all" ? undefined : Number(filter), cursors.at(-1), signal), retry: false });
  const users = useWorkspaceQuery({ queryKey: ["invoice-pool-users",companyId,actor,search],
    enabled:ready && canView && canViewUsers,
    queryFn:()=>fetchUsers({page:1,limit:40,active:true,search:search ? {field:"name",operator:"contains",value:search}:undefined}) });
  const mutation = useMutation({
    mutationFn: async (action: Omit<InvoicePoolAction, "requestId">) => {
      // Preserve the exact request across uncertain responses and page reloads.
      const stored = sessionStorage.getItem(key);
      const request: InvoicePoolAction = stored ? JSON.parse(stored) : { ...action, requestId: crypto.randomUUID() };
      sessionStorage.setItem(key, JSON.stringify(request));
      setPending({ key, action: request });
      return manageInvoicePool(request);
    },
    onError: (error) => {
      if(isAxiosError(error) && ([400,403,422].includes(error.response?.status ?? 0) || error.response?.status === 409 && !normalizeApiError(error).message.toLowerCase().includes("still being resolved"))){
        sessionStorage.removeItem(key);setPending(null);
      }
    },
    onSuccess: async () => {
      sessionStorage.removeItem(key); setPending(null); setSelection([]); setCursors([undefined]);
      await queryClient.invalidateQueries({ queryKey: ["invoice-pool", companyId] });
    },
  });
  const selected = selection.filter(item => query.data?.items.some(row => row.id === item.id));
  const act = (action: "generate" | "assign" | "return", values = form.getValues()) => {
    if (!ready || (action === "generate" ? !canGenerate : !canAssign)) return;
    mutation.mutate(action === "generate" ? { action, count: values.count, userId: values.userId }
      : { action, ...(action === "assign" ? { userId: values.userId } : {}), items: selected.map(item => ({ id: item.id, token: item.allocation.token })) });
  };
  return { form, query, mutation, canView, canViewUsers, canGenerate, canAssign, ready, filter,
    setFilter: (value: string) => { setFilter(value); setCursors([undefined]); setSelection([]); },
    selected, toggle: (item: ReservedInvoice) => setSelection(current => current.some(row => row.id === item.id) ? current.filter(row => row.id !== item.id) : [...current, item]),
    next: () => { if (query.data?.nextCursor) { setCursors([...cursors, query.data.nextCursor]); setSelection([]); } },
    previous: () => { setCursors(cursors.slice(0, -1)); setSelection([]); }, hasPrevious: cursors.length > 1,
    userSearch, setUserSearch, users, act, retry: () => { if(pending?.key===key) mutation.mutate(pending.action); }, pending: pending?.key === key,
    canAssignSelection: selected.length > 0 && selected.every(item => item.allocation.userId === 0),
    canReturnSelection: selected.length > 0 && selected.every(item => !item.claimed && item.allocation.userId !== 0),
  };
}
