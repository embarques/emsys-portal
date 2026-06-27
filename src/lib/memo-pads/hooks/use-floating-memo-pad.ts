"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  useCreateMemoPad,
  useMemoPads,
  useUpdateMemoPad,
} from "@/lib/memo-pads/hooks/use-memo-pads";
import { DEFAULT_MEMO_PAD_LIST_PARAMS, type MemoPadListParams } from "@/lib/memo-pads/types";

/**
 * The floating memo pad is a single per-account scratch note. It is scoped to a
 * well-known record name so it never collides with other memo pads created
 * through the memo pads directory.
 */
const FLOATING_MEMO_PAD_NAME = "Quick notes";
const AUTOSAVE_DELAY_MS = 800;

const FLOATING_MEMO_PAD_PARAMS: MemoPadListParams = {
  ...DEFAULT_MEMO_PAD_LIST_PARAMS,
  limit: 1,
  search: { value: FLOATING_MEMO_PAD_NAME, field: "name", operator: "eq" },
};

/** Lightweight read used by the toolbar toggle to show the "has notes" dot. */
export function useMemoPadHasNotes(): boolean {
  const { data } = useMemoPads(FLOATING_MEMO_PAD_PARAMS);
  return Boolean(data?.items[0]?.content.trim());
}

export type UseFloatingMemoPadResult = {
  content: string;
  updateContent: (next: string) => void;
  clearContent: () => void;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
};

export function useFloatingMemoPad(): UseFloatingMemoPadResult {
  const { data, isLoading, isError } = useMemoPads(FLOATING_MEMO_PAD_PARAMS);
  const serverPad = data?.items[0] ?? null;

  const createMemoPad = useCreateMemoPad();
  const updateMemoPad = useUpdateMemoPad();

  const [draft, setDraft] = useState("");

  const latestDraftRef = useRef("");
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const padIdRef = useRef<string | null>(null);
  const padNameRef = useRef(FLOATING_MEMO_PAD_NAME);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  const saveNow = useCallback(async () => {
    if (!dirtyRef.current) return;

    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }

    savingRef.current = true;
    const content = latestDraftRef.current;

    try {
      if (padIdRef.current) {
        await updateMemoPad.mutateAsync({
          memoPadId: padIdRef.current,
          values: { name: padNameRef.current, content },
        });
      } else {
        const created = await createMemoPad.mutateAsync({
          name: padNameRef.current,
          content,
        });
        padIdRef.current = created.id;
      }

      if (latestDraftRef.current === content) {
        dirtyRef.current = false;
      }
    } catch {
      // Keep the dirty flag so the next edit (or unmount flush) retries the save.
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void saveNow();
      }
    }
  }, [createMemoPad, updateMemoPad]);

  const saveNowRef = useRef(saveNow);
  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    if (!serverPad) return;

    padIdRef.current = serverPad.id;
    padNameRef.current = serverPad.name || FLOATING_MEMO_PAD_NAME;

    if (!hydratedRef.current && !dirtyRef.current) {
      setDraft(serverPad.content);
      latestDraftRef.current = serverPad.content;
      hydratedRef.current = true;
    }
  }, [serverPad]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      void saveNowRef.current();
    };
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
  }, [saveNow]);

  const updateContent = useCallback(
    (next: string) => {
      setDraft(next);
      latestDraftRef.current = next;
      dirtyRef.current = true;
      hydratedRef.current = true;
      scheduleSave();
    },
    [scheduleSave],
  );

  const clearContent = useCallback(() => {
    setDraft("");
    latestDraftRef.current = "";
    dirtyRef.current = true;
    hydratedRef.current = true;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    void saveNow();
  }, [saveNow]);

  return {
    content: draft,
    updateContent,
    clearContent,
    isLoading,
    isError,
    isSaving: createMemoPad.isPending || updateMemoPad.isPending,
  };
}
