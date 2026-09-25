"use client";

import { useLayoutEffect, useRef } from "react";

/** Constrain workspace forms to the space below the shell chrome. */
export function useFormViewport() {
  const shellRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    // Include the actual header, tab bar, and workspace padding instead of
    // assuming a fixed offset that can put the footer below the viewport.
    const updateViewportInset = () => {
      if (!shell.getClientRects().length) return;
      const bottomPadding = shell.parentElement
        ? Number.parseFloat(getComputedStyle(shell.parentElement).paddingBottom) || 0
        : 0;
      // The invoice wizard also renders inside viewport-fixed dialogs. Their
      // position is independent of the document's current scroll offset.
      let scrollOffset = window.scrollY;
      for (let ancestor = shell.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).position === "fixed") {
          scrollOffset = 0;
          break;
        }
      }
      const inset = shell.getBoundingClientRect().top + scrollOffset + bottomPadding;
      shell.style.setProperty("--form-viewport-inset", `${inset}px`);
    };

    const observer = new ResizeObserver(updateViewportInset);
    for (let ancestor = shell.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor);
    }
    updateViewportInset();
    window.addEventListener("resize", updateViewportInset);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateViewportInset);
    };
  }, []);

  return shellRef;
}
