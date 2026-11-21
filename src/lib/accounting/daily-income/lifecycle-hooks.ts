"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { invalidateJournalLifecycle } from "./journal-lifecycle-cache";
import { applyJournalLifecycle } from "./lifecycle-api";
export function useJournalLifecycle() {
    const client = useQueryClient();
    const { companyId } = useAuth();
    return useMutation({ mutationFn: applyJournalLifecycle, retry: false,
      onSuccess: (_data, command) => invalidateJournalLifecycle(client, companyId, { ...command, noteOnly: command.action === "note" }),
    });
}
