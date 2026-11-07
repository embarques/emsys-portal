"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
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

import { INVOICE_POOL_FILTER_FIELDS } from "@/lib/invoices/invoice-pool-filters";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import type { PaginatedResult } from "@/lib/api/types";
import type { User } from "@/lib/users/types";

function isDefinitiveFailure(error: unknown) {
  return isAxiosError(error) && ([400,403,422].includes(error.response?.status ?? 0) || error.response?.status === 409 && !normalizeApiError(error).message.toLowerCase().includes("still being resolved"));
}

export function useInvoicePool() {
  const { companyId, user, email, hasPermission, loading, roleLoading } = useAuth();
  const transport = useAppSelector(state => state.auth);
  const queryClient = useQueryClient();
  const canView = hasPermission("canViewInvoicePool", "invoice_pool");
  const canGenerate = hasPermission("canGenerateInvoicePool", "invoice_pool");
  const canViewUsers = hasPermission("canViewUser", "user");
  const canAssign = hasPermission("canAssignInvoicePool", "invoice_pool");
  const ready = !loading && !roleLoading && !!companyId && !!transport.idToken && transport.companyId === companyId;
  const [numberSearch, setNumberSearch] = useState("");
  const numberQuery = useDebouncedValue(numberSearch.trim(), 300);
  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const filterQuery = JSON.stringify(filterRows.filter(row => isCompleteFilterRow(row, INVOICE_POOL_FILTER_FIELDS)));
  const appliedFilterQuery = useDebouncedValue(filterQuery, 300);
  const searchPending = numberSearch.trim() !== numberQuery || filterQuery !== appliedFilterQuery;
  const appliedRows: TableFilterRowState[] = JSON.parse(appliedFilterQuery);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("id:asc");
  const [selection, setSelection] = useState<ReservedInvoice[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const search = useDeferredValue(userSearch);
  const [filterUserSearch, setFilterUserSearch] = useState("");
  const filterSearch = useDebouncedValue(filterUserSearch.trim(), 300);
  const actor = user?.uid ?? email ?? "anonymous";
  const key = `invoice-pool-action:${companyId}:${actor}`;
  const [pending, setPending] = useState<{ key: string; action: InvoicePoolAction } | null>(() => {
    if(typeof window === "undefined") return null;
    const stored=sessionStorage.getItem(key);
    if(!stored) return null;
    try{return {key,action:JSON.parse(stored)};}catch{return null;}
  });
  const form = useForm<InvoicePoolForm>({ resolver: zodResolver(invoicePoolFormSchema), defaultValues: { count: 50, userId: 0 } });
  const queryKey = ["invoice-pool", companyId, actor, appliedFilterQuery, numberQuery, page, sort];
  const query = useWorkspaceQuery({ queryKey, enabled: ready && canView && !searchPending,
    queryFn: ({ signal }) => fetchInvoicePool(page, sort, signal, numberQuery, appliedRows), retry: false });
  const users = useWorkspaceQuery({ queryKey: ["invoice-pool-users",companyId,actor,search],
    enabled:ready && canView && canViewUsers,
    queryFn:()=>fetchUsers({page:1,limit:40,active:true,search:search ? {field:"name",operator:"contains",value:search}:undefined}) });
  const filterUsers = useWorkspaceQuery({ queryKey: ["invoice-pool-users",companyId,actor,filterSearch],
    enabled:ready && canView && canViewUsers,
    queryFn:()=>fetchUsers({page:1,limit:40,active:true,search:filterSearch ? {field:"name",operator:"contains",value:filterSearch}:undefined}) });
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
      if(isDefinitiveFailure(error)){
        sessionStorage.removeItem(key);setPending(null);
      }
    },
    onSuccess: async () => {
      sessionStorage.removeItem(key); setPending(null); setSelection([]); setPage(1);
      await queryClient.invalidateQueries({ queryKey: ["invoice-pool", companyId] });
    },
  });
  const selected = (query.data?.items ?? []).filter(item => !item.claimed && item.allocation.token && selection.some(row => row.id === item.id));
  const selectionLocked = mutation.isPending || pending?.key === key || query.isFetching || searchPending || query.isPlaceholderData;
  const selectable = (query.data?.items ?? []).filter(item => !item.claimed && item.allocation.token);
  const setSelectedIds = (ids: string[]) => { if (!selectionLocked) setSelection(selectable.filter(item => ids.includes(item.id))); };
  /** `onSettledForRetry` fires on success or when the request is kept for retry (not on a definitive rejection). */
  const act = (action: "generate" | "assign" | "return", values = form.getValues(), onSettledForRetry?: () => void) => {
    if (!ready || (action !== "generate" && selectionLocked) || (action === "generate" ? !canGenerate : !canAssign)) return;
    mutation.mutate(action === "generate" ? { action, count: values.count, userId: values.userId }
      : { action, ...(action === "assign" ? { userId: values.userId } : {}), items: selected.flatMap(item => item.allocation.token ? [{ id: item.id, token: item.allocation.token }] : []) },
      { onSuccess: () => onSettledForRetry?.(), onError: error => { if (!isDefinitiveFailure(error)) onSettledForRetry?.(); } });
  };
  const selectedUserIds = new Set(filterRows.filter(row => row.field === "allocation.userId").map(row => row.value));
  const cachedSelectedUsers = queryClient.getQueriesData<PaginatedResult<User>>({ queryKey: ["invoice-pool-users", companyId, actor] })
    .flatMap(([, data]) => (data?.items ?? []).filter(user => selectedUserIds.has(String(user.id))));
  const filterUserOptions = canViewUsers ? Array.from(new Map([...cachedSelectedUsers, ...(filterUsers.data?.items ?? [])]
    .map(user => [String(user.id), { value: String(user.id), label: user.name || user.email }])).values()) : [];
  return { numberSearch, searchPending, selectionLocked, selectable, setSelectedIds,
    setNumberSearch: (value: string) => { setNumberSearch(value); setPage(1); setSelection([]); },
    form, query, mutation, canView, canViewUsers, canGenerate, canAssign, ready, filterRows,
    setFilterRows: (rows: TableFilterRowState[]) => { setFilterRows(rows); setPage(1); setSelection([]); },
    selected, toggle: (item: ReservedInvoice) => { if (selectionLocked || item.claimed) return; setSelection(current => current.some(row => row.id === item.id) ? current.filter(row => row.id !== item.id) : [...current, item]); },
    sort,
    setSort: (value: string) => { setSort(value); setPage(1); setSelection([]); },
    next: () => { if (query.data?.hasNext) { setPage(page + 1); setSelection([]); } },
    previous: () => { setPage(Math.max(1, page - 1)); setSelection([]); }, hasPrevious: page > 1,
    userSearch, setUserSearch, users, filterUsers, setFilterUserSearch,
    filterUserOptions,
    act, retry: () => { if(pending?.key===key) mutation.mutate(pending.action); }, pending: pending?.key === key,
    justGenerated: mutation.isSuccess && mutation.variables?.action === "generate",
    canAssignSelection: selected.length > 0 && selected.every(item => item.allocation.userId === 0),
    canReturnSelection: selected.length > 0 && selected.every(item => !item.claimed && item.allocation.userId !== 0),
  };
}
