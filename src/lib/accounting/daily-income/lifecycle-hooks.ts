"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { applyJournalLifecycle } from "./lifecycle-api";
export function useJournalLifecycle() {
    const client = useQueryClient();
    const { companyId } = useAuth();
    return useMutation({ mutationFn: applyJournalLifecycle, retry: false, onSuccess: (_data, command) => client.invalidateQueries({ predicate: query => query.queryKey[0] === "accounting" && (query.queryKey.includes(companyId) || query.queryKey.includes(command.id)) ||
                command.action !== "note" && query.queryKey[0] === "invoices" && (query.queryKey.includes(companyId) || Boolean(command.invoiceId && query.queryKey.includes(command.invoiceId))) }) });
}
