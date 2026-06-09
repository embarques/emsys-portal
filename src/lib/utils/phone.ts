const PHONE_DIGIT_LIMIT = 10;

/** Strip non-digits and cap at 10 characters for storage/API payloads. */
export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_DIGIT_LIMIT);
}

/** Format stored digits as xxx-xxx-xxxx for display. */
export function formatPhoneDisplay(digits: string): string {
  const cleaned = sanitizePhoneDigits(digits);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/** Normalize any phone value to digits-only storage format. */
export function normalizeStoredPhone(value: string): string {
  return sanitizePhoneDigits(value);
}

/** Format a stored or raw phone value for UI display. */
export function formatPhoneForDisplay(value: string): string {
  const digits = sanitizePhoneDigits(value);
  return digits ? formatPhoneDisplay(digits) : "";
}

/** Format a phone for tables and detail views, using em dash when empty. */
export function formatPhoneDisplayOrDash(value: string): string {
  return formatPhoneForDisplay(value) || "—";
}
