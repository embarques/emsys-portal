const E164_MAX_DIGITS = 15;

const PHONE_API_FIELD_KEYS = new Set(["phone1", "phone2", "number", "phones.number"]);

/** Strip formatting characters; preserve a leading + and digits only for API storage. */
export function normalizeStoredPhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "").slice(0, E164_MAX_DIGITS);
  if (!digits) return "";

  return hasPlus ? `+${digits}` : digits;
}

/** Strip non-digits, capped at E.164 length. */
export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, E164_MAX_DIGITS);
}

function formatUsNationalDigits(digits: string): string {
  const national = digits.replace(/\D/g, "").slice(-10);
  if (national.length <= 3) return national;
  if (national.length <= 6) return `${national.slice(0, 3)}-${national.slice(3)}`;
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

/** Format a stored phone value for UI display (adds dashes; does not mutate storage). */
export function formatPhoneForDisplay(value: string): string {
  const stored = normalizeStoredPhone(value);
  if (!stored) return "";

  const digits = stored.replace(/\D/g, "");
  const hasPlus = stored.startsWith("+");

  if (digits.length === 11 && digits.startsWith("1")) {
    const national = formatUsNationalDigits(digits.slice(1));
    return hasPlus ? `+1 ${national}` : `1-${national}`;
  }

  if (digits.length === 10) {
    return formatUsNationalDigits(digits);
  }

  if (hasPlus && digits.length > 10) {
    const national = formatUsNationalDigits(digits.slice(-10));
    const country = digits.slice(0, -10);
    return `+${country} ${national}`;
  }

  if (digits.length > 3) {
    return formatUsNationalDigits(digits);
  }

  return digits;
}

/** Format a stored phone for input controls while editing. */
export function formatPhoneDisplay(value: string): string {
  return formatPhoneForDisplay(value);
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

/** Format a phone for tables and detail views, using em dash when empty. */
export function formatPhoneDisplayOrDash(value: string): string {
  return formatPhoneForDisplay(value) || "—";
}
