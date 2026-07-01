"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useCreateMemoPad,
  useMemoPadPicker,
  useUpdateMemoPad,
} from "@/lib/memo-pads/hooks/use-memo-pads";
import { type MemoPad } from "@/lib/memo-pads/types";

const DEFAULT_MEMO_PAD_NAME = "Quick notes";
const AUTOSAVE_DELAY_MS = 800;
const MEMO_PAD_PICKER_LIMIT = 200;

function findQuickNotesPad(memoPads: MemoPad[]): MemoPad | undefined {
  return memoPads.find((memoPad) => memoPad.name.trim() === DEFAULT_MEMO_PAD_NAME);
}

/** Lightweight read used by the toolbar toggle to show the "has notes" dot. */
export function useMemoPadHasNotes(): boolean {
  const { data } = useMemoPadPicker(MEMO_PAD_PICKER_LIMIT);
  const quickNotes = findQuickNotesPad(data?.items ?? []);
  return Boolean(quickNotes?.content.trim());
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
  const memoPadsQuery = useMemoPadPicker(MEMO_PAD_PICKER_LIMIT);
  const memoPads = useMemo(
    () => memoPadsQuery.data?.items ?? [],
    [memoPadsQuery.data?.items],
  );

  const createMemoPad = useCreateMemoPad();
  const updateMemoPad = useUpdateMemoPad();

  const [draft, setDraft] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const latestDraftRef = useRef("");
  const dirtyRef = useRef(false);
  const padIdRef = useRef<string | null>(null);
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
          values: { name: DEFAULT_MEMO_PAD_NAME, content },
        });
      } else {
        const created = await createMemoPad.mutateAsync({
          name: DEFAULT_MEMO_PAD_NAME,
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

  const hydratePad = useCallback((memoPad: MemoPad) => {
    padIdRef.current = memoPad.id;
    setDraft(memoPad.content);
    latestDraftRef.current = memoPad.content;
    dirtyRef.current = false;
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (memoPadsQuery.isLoading || initialized || isInitializing) return;

    const quickNotes = findQuickNotesPad(memoPads);
    if (quickNotes) {
      hydratePad(quickNotes);
      return;
    }

    setIsInitializing(true);
    void createMemoPad
      .mutateAsync({ name: DEFAULT_MEMO_PAD_NAME, content: "" })
      .then((created) => {
        hydratePad(created);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [
    createMemoPad,
    hydratePad,
    initialized,
    isInitializing,
    memoPads,
    memoPadsQuery.isLoading,
  ]);

  useEffect(() => {
    if (!initialized || dirtyRef.current) return;

    const quickNotes = findQuickNotesPad(memoPads);
    if (!quickNotes || quickNotes.id !== padIdRef.current) return;

    setDraft(quickNotes.content);
    latestDraftRef.current = quickNotes.content;
  }, [initialized, memoPads]);

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
      scheduleSave();
    },
    [scheduleSave],
  );

  const clearContent = useCallback(() => {
    setDraft("");
    latestDraftRef.current = "";
    dirtyRef.current = true;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    void saveNow();
  }, [saveNow]);

  const isLoading =
    memoPadsQuery.isLoading || isInitializing || (!initialized && memoPads.length === 0);

  return {
    content: draft,
    updateContent,
    clearContent,
    isLoading,
    isError: memoPadsQuery.isError,
    isSaving: createMemoPad.isPending || updateMemoPad.isPending,
  };
}
