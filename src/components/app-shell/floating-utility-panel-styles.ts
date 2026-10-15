/** Shared shell for floating calculator and memo pad. */
export const floatingUtilityPanelClassName =
  "pointer-events-auto flex w-[min(100vw-2rem,18rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl";

/** Height when only one utility panel is open. */
export const floatingUtilityPanelSingleHeightClassName = "h-[30.25rem]";

/**
 * Height when both panels are open.
 * Topbar is h-20; keep 1rem beneath it, plus the bottom inset and the gap
 * between panels. Shrink equally so the upper panel does not sit on the viewport edge.
 * Floor at 25rem so the calculator keys stay usable.
 */
export const floatingUtilityPanelPairedHeightClassName =
  "h-[min(30.25rem,max(25rem,calc((100dvh-6rem-1rem-0.75rem)/2)))] sm:h-[min(30.25rem,max(25rem,calc((100dvh-6rem-1.5rem-0.75rem)/2)))]";

export const floatingUtilityPanelBodyClassName = "flex min-h-0 flex-1 flex-col p-3";

/** Base position for the panel resting at the bottom of the stack. */
export const floatingUtilityPanelBasePositionClassName = "bottom-4 sm:bottom-6";

/**
 * Upper panel sits above the lower one by one paired height plus a 0.75rem gap.
 * Matches the single-panel stack offset when both panels still fit at 30.25rem.
 */
export const floatingUtilityPanelStackedPositionClassName =
  "bottom-[calc(1rem+0.75rem+min(30.25rem,max(25rem,calc((100dvh-6rem-1rem-0.75rem)/2))))] sm:bottom-[calc(1.5rem+0.75rem+min(30.25rem,max(25rem,calc((100dvh-6rem-1.5rem-0.75rem)/2))))]";

/**
 * Monotonic sequence used to record the order floating panels are opened, so the
 * first opened panel rests at the bottom and later ones stack above it.
 */
let panelOpenSequence = 0;

export function nextPanelOpenSequence(): number {
  panelOpenSequence += 1;
  return panelOpenSequence;
}
