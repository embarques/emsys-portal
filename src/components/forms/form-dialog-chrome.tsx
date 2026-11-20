"use client";

import * as React from "react";

/**
 * When true, FormBody / FormFooter drop the page-tab muted wash + bordered bar
 * and match Assign-route compact dialog chrome (set by CompactActionDialogContent).
 */
const FormDialogChromeContext = React.createContext(false);

export function FormDialogChromeProvider({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <FormDialogChromeContext.Provider value={active}>
      {children}
    </FormDialogChromeContext.Provider>
  );
}

export function useFormDialogChrome() {
  return React.useContext(FormDialogChromeContext);
}
