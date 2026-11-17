import * as React from "react";

/** Whether a required / locked select should auto-pick its only available option. */
export function shouldAutoDefaultSelect(args: {
  required?: boolean;
  clearable?: boolean;
  /** True when options include a real empty-value choice (not a "Select…" placeholder). */
  hasExplicitEmptyOption: boolean;
}): boolean {
  return Boolean(args.required) || (args.clearable === false && !args.hasExplicitEmptyOption);
}

/**
 * When a required (or non-clearable) select has exactly one real choice, return
 * that value so the UI can default it. Remote/partial lists must pass enabled=false.
 */
export function resolveAutoDefaultSelectValue(args: {
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Non-empty, enabled option values after placeholder filtering. */
  selectableValues: readonly string[];
  value: string;
}): string | null {
  if (!args.enabled || args.disabled || args.loading) return null;
  if (args.selectableValues.length !== 1) return null;
  const only = args.selectableValues[0];
  if (!only || args.value === only) return null;
  // Only fill an empty control; never overwrite an existing selection.
  if (args.value !== "") return null;
  return only;
}

/** Applies {@link resolveAutoDefaultSelectValue} via onValueChange without advancing focus. */
export function useAutoDefaultSingleSelectOption(args: {
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  selectableValues: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const onValueChangeRef = React.useRef(args.onValueChange);
  onValueChangeRef.current = args.onValueChange;
  const selectableValuesRef = React.useRef(args.selectableValues);
  selectableValuesRef.current = args.selectableValues;
  const selectableKey = args.selectableValues.join("\0");

  React.useEffect(() => {
    const next = resolveAutoDefaultSelectValue({
      enabled: args.enabled,
      disabled: args.disabled,
      loading: args.loading,
      selectableValues: selectableValuesRef.current,
      value: args.value,
    });
    if (next != null) onValueChangeRef.current(next);
  }, [args.enabled, args.disabled, args.loading, selectableKey, args.value]);
}
