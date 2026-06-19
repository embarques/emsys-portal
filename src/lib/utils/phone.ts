const E164_MAX_DIGITS = 15;

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

/** Prefer API displayNumber when present; otherwise format the stored number locally. */
export function resolvePhoneDisplayValue(number: string, displayNumber?: string): string {
  const display = displayNumber?.trim();
  if (display) return display;
  return formatPhoneForDisplay(number);
}

/** Whether an API field name represents a phone value. */
export function isPhoneApiField(field: string): boolean {
  const normalized = field.trim().toLowerCase();
  if (normalized === "phone1" || normalized === "phone2") return true;
  if (normalized.endsWith(".phone1") || normalized.endsWith(".phone2")) return true;
  return normalized.includes(".phones.") || normalized.endsWith(".phones.number");
}

/** Normalize a search/filter value based on the target API field. */
export function normalizeApiSearchValueForField(field: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return isPhoneApiField(field) ? normalizeStoredPhone(trimmed) : trimmed;
}

/** Format a phone for tables and detail views, using em dash when empty. */
export function formatPhoneDisplayOrDash(value: string, displayNumber?: string): string {
  return resolvePhoneDisplayValue(value, displayNumber) || "—";
}

/** Digits only, suitable for tel: and wa.me links. */
export function getPhoneDialDigits(value: string): string {
  return normalizeStoredPhone(value).replace(/\D/g, "");
}

/** Build a tel: href for calling, or null when the number is empty. */
export function buildTelHref(value: string): string | null {
  const digits = getPhoneDialDigits(value);
  if (!digits) return null;
  return `tel:+${digits}`;
}

/** Build a WhatsApp chat href, or null when the number is empty. */
export function buildWhatsAppHref(value: string): string | null {
  const digits = getPhoneDialDigits(value);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}
