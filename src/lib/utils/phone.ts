const PHONE_DIGIT_LIMIT = 10;

const PHONE_API_FIELD_KEYS = new Set(["phone1", "phone2", "number"]);

/** Strip non-digits and cap at 10 characters. */
export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_DIGIT_LIMIT);
}

/** Format digits as xxx-xxx-xxxx for display and storage. */
export function formatPhoneDisplay(digits: string): string {
  const cleaned = sanitizePhoneDigits(digits);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

/** Canonical phone format for API save, load, and query values. */
export function normalizeStoredPhone(value: string): string {
  return formatPhoneDisplay(value);
}

/** Whether an API field name represents a phone value. */
export function isPhoneApiField(field: string): boolean {
  const leaf = field.split(".").pop()?.trim() ?? field.trim();
  return PHONE_API_FIELD_KEYS.has(leaf);
}

/** Normalize a search/filter value based on the target API field. */
export function normalizeApiSearchValueForField(field: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return isPhoneApiField(field) ? normalizeStoredPhone(trimmed) : trimmed;
}

/** Format a stored or raw phone value for UI display. */
export function formatPhoneForDisplay(value: string): string {
  return normalizeStoredPhone(value);
}

/** Format a phone for tables and detail views, using em dash when empty. */
export function formatPhoneDisplayOrDash(value: string): string {
  return formatPhoneForDisplay(value) || "—";
}
