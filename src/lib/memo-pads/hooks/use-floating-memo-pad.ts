"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  useCreateMemoPad,
  useMemoPadPicker,
  useUpdateMemoPad,
} from "@/lib/memo-pads/hooks/use-memo-pads";
import { fetchMemoPadById } from "@/lib/memo-pads/api/memo-pads-api";
import { type MemoPad } from "@/lib/memo-pads/types";

const DEFAULT_MEMO_PAD_NAME = "Quick notes";
const AUTOSAVE_DELAY_MS = 800;
const SELECTED_MEMO_PAD_STORAGE_KEY = "emsys-portal:floating-memo-pad-id";
const MEMO_PAD_PICKER_LIMIT = 200;

function readStoredMemoPadId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SELECTED_MEMO_PAD_STORAGE_KEY)?.trim();
  return stored || null;
}

function writeStoredMemoPadId(memoPadId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_MEMO_PAD_STORAGE_KEY, memoPadId);
}

/** Lightweight read used by the toolbar toggle to show the "has notes" dot. */
export function useMemoPadHasNotes(): boolean {
  const { data } = useMemoPadPicker(MEMO_PAD_PICKER_LIMIT);
  return data?.items.some((memoPad) => memoPad.content.trim()) ?? false;
}

export type UseFloatingMemoPadResult = {
  memoPads: MemoPad[];
  selectedMemoPadId: string | null;
  selectMemoPad: (memoPadId: string) => void;
  content: string;
  updateContent: (next: string) => void;
  clearContent: () => void;
  isLoadingPads: boolean;
  isLoading: boolean;
  isLoadingSelectedPad: boolean;
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

  const [selectedMemoPadId, setSelectedMemoPadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isLoadingSelectedPad, setIsLoadingSelectedPad] = useState(false);

  const latestDraftRef = useRef("");
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const padIdRef = useRef<string | null>(null);
  const padNameRef = useRef(DEFAULT_MEMO_PAD_NAME);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const [isCreatingDefault, setIsCreatingDefault] = useState(false);
  const switchingRef = useRef(false);

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
        setSelectedMemoPadId(created.id);
        writeStoredMemoPadId(created.id);
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
    padNameRef.current = memoPad.name || DEFAULT_MEMO_PAD_NAME;
    setSelectedMemoPadId(memoPad.id);
    writeStoredMemoPadId(memoPad.id);
    setDraft(memoPad.content);
    latestDraftRef.current = memoPad.content;
    dirtyRef.current = false;
    hydratedRef.current = true;
  }, []);

  const loadMemoPad = useCallback(
    async (memoPadId: string) => {
      setIsLoadingSelectedPad(true);
      try {
        const memoPad = await fetchMemoPadById(memoPadId);
        hydratePad(memoPad);
        return memoPad;
      } catch {
        const fallback = memoPads.find((item) => item.id === memoPadId);
        if (fallback) {
          hydratePad(fallback);
          return fallback;
        }
        return null;
      } finally {
        setIsLoadingSelectedPad(false);
      }
    },
    [hydratePad, memoPads],
  );

  const selectMemoPad = useCallback(
    async (memoPadId: string) => {
      if (!memoPadId || memoPadId === padIdRef.current || switchingRef.current) return;

      switchingRef.current = true;
      try {
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        await saveNowRef.current();
        await loadMemoPad(memoPadId);
      } finally {
        switchingRef.current = false;
      }
    },
    [loadMemoPad],
  );

  useEffect(() => {
    if (memoPadsQuery.isLoading || selectedMemoPadId || isCreatingDefault) return;

    if (memoPads.length === 0) {
      setIsCreatingDefault(true);
      void createMemoPad
        .mutateAsync({ name: DEFAULT_MEMO_PAD_NAME, content: "" })
        .then((created) => {
          hydratePad(created);
        })
        .finally(() => {
          setIsCreatingDefault(false);
        });
      return;
    }

    const storedId = readStoredMemoPadId();
    const initialId =
      (storedId && memoPads.some((memoPad) => memoPad.id === storedId) ? storedId : null) ??
      memoPads[0]?.id;

    if (initialId) {
      void loadMemoPad(initialId);
    }
  }, [
    createMemoPad,
    hydratePad,
    isCreatingDefault,
    loadMemoPad,
    memoPads,
    memoPadsQuery.isLoading,
    selectedMemoPadId,
  ]);

  useEffect(() => {
    if (!selectedMemoPadId || dirtyRef.current) return;

    const serverPad = memoPads.find((memoPad) => memoPad.id === selectedMemoPadId);
    if (!serverPad) return;

    padNameRef.current = serverPad.name || DEFAULT_MEMO_PAD_NAME;
    if (!hydratedRef.current) {
      setDraft(serverPad.content);
      latestDraftRef.current = serverPad.content;
      hydratedRef.current = true;
    }
  }, [memoPads, selectedMemoPadId]);

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

  const isLoading =
    memoPadsQuery.isLoading ||
    isCreatingDefault ||
    isLoadingSelectedPad ||
    (!selectedMemoPadId && memoPads.length === 0);

  return {
    memoPads,
    selectedMemoPadId,
    selectMemoPad,
    content: draft,
    updateContent,
    clearContent,
    isLoadingPads: memoPadsQuery.isLoading,
    isLoading,
    isLoadingSelectedPad,
    isError: memoPadsQuery.isError,
    isSaving: createMemoPad.isPending || updateMemoPad.isPending,
  };
}
