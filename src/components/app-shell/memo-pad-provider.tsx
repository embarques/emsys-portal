"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { nextPanelOpenSequence } from "@/components/app-shell/floating-utility-panel-styles";

type MemoPadContextValue = {
  open: boolean;
  openedAt: number | null;
  toggle: () => void;
  close: () => void;
};

const MemoPadContext = createContext<MemoPadContextValue | null>(null);

export function MemoPadProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      setOpenedAt(next ? nextPanelOpenSequence() : null);
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setOpenedAt(null);
  }, []);

  const value = useMemo(
    () => ({
      open,
      openedAt,
      toggle,
      close,
    }),
    [close, open, openedAt, toggle]
  );

  return <MemoPadContext.Provider value={value}>{children}</MemoPadContext.Provider>;
}

export function useMemoPad() {
  const context = useContext(MemoPadContext);
  if (!context) {
    throw new Error("useMemoPad must be used within MemoPadProvider.");
  }
  return context;
}
