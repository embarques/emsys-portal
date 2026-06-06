"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type MemoPadContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const MemoPadContext = createContext<MemoPadContextValue | null>(null);

export function MemoPadProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      open,
      toggle,
      close,
    }),
    [close, open, toggle]
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
