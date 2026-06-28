import type { CSSProperties } from "react";

/** Preset swatches for the tab color picker (Chrome-style). */
export const WORKSPACE_TAB_PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;

export function normalizeWorkspaceTabColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

export function getWorkspaceTabChromeStyle(
  color: string | null | undefined,
  active: boolean,
): CSSProperties | undefined {
  const normalized = normalizeWorkspaceTabColor(color);
  if (!normalized) return undefined;

  return {
    borderTopWidth: 3,
    borderTopColor: normalized,
    backgroundColor: active
      ? `color-mix(in srgb, ${normalized} 12%, var(--background))`
      : `color-mix(in srgb, ${normalized} 10%, var(--muted))`,
  };
}
