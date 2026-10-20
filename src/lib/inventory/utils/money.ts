const USD_INPUT = /^\d+(\.\d{1,2})?$/;

/** Exact USD text → integer cents. Returns `null` for blank or invalid input. */
export function parseUsdToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!USD_INPUT.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function isValidUsdInput(value: string): boolean {
  return parseUsdToMinor(value) !== null;
}

/** Integer cents → editable USD text (`1999` → `"19.99"`). */
export function minorToUsdInput(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "";
  return (minor / 100).toFixed(2);
}

/** Positive whole-unit quantity text → integer, or `null`. */
export function parseWholeQuantity(value: string, { allowZero = false, allowNegative = false } = {}): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  if (!allowNegative && parsed < 0) return null;
  if (!allowZero && parsed === 0) return null;
  return parsed;
}
