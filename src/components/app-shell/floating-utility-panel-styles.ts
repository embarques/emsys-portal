/** Shared shell size for floating calculator and memo pad. */
export const floatingUtilityPanelClassName =
  "pointer-events-auto flex h-[30.25rem] w-[min(100vw-2rem,18rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl";

export const floatingUtilityPanelBodyClassName = "flex min-h-0 flex-1 flex-col p-3";

/** Base position for the panel resting at the bottom of the stack. */
export const floatingUtilityPanelBasePositionClassName = "bottom-4 sm:bottom-6";

/** Position for the panel stacked on top of another open panel. */
export const floatingUtilityPanelStackedPositionClassName =
  "bottom-[calc(30.25rem+1.75rem)] sm:bottom-[calc(30.25rem+2.25rem)]";

/**
 * Monotonic sequence used to record the order floating panels are opened, so the
 * first opened panel rests at the bottom and later ones stack above it.
 */
let panelOpenSequence = 0;

export function nextPanelOpenSequence(): number {
  panelOpenSequence += 1;
  return panelOpenSequence;
}
