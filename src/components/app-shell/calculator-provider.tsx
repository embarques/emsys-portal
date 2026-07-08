"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { nextPanelOpenSequence } from "@/components/app-shell/floating-utility-panel-styles";

type CalculatorContextValue = {
  open: boolean;
  openedAt: number | null;
  toggle: () => void;
  close: () => void;
};

const CalculatorContext = createContext<CalculatorContextValue | null>(null);

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
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

  return <CalculatorContext.Provider value={value}>{children}</CalculatorContext.Provider>;
}

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error("useCalculator must be used within CalculatorProvider.");
  }
  return context;
}
