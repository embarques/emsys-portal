export type RowPointerState = {
  x: number;
  y: number;
};

const DRAG_THRESHOLD_PX = 4;

export function createRowPointerState(clientX: number, clientY: number): RowPointerState {
  return { x: clientX, y: clientY };
}

export function didPointerMove(
  state: RowPointerState | null,
  clientX: number,
  clientY: number,
): boolean {
  if (!state) return false;
  return (
    Math.abs(clientX - state.x) > DRAG_THRESHOLD_PX ||
    Math.abs(clientY - state.y) > DRAG_THRESHOLD_PX
  );
}

export function hasTextSelection(): boolean {
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  return Boolean(selection && selection.type === "Range" && selection.toString().length > 0);
}

export function shouldIgnoreRowClick(
  pointerState: RowPointerState | null,
  clientX: number,
  clientY: number,
  target: EventTarget | null,
): boolean {
  if (target instanceof Element && target.closest("[data-stop-row-click]")) {
    return true;
  }

  if (hasTextSelection()) return true;
  if (didPointerMove(pointerState, clientX, clientY)) return true;
  return false;
}
