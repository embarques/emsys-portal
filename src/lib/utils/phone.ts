/** Canonical national phone length (NANP — USA & Dominican Republic). */
export const PHONE_NATIONAL_DIGITS = 10;

/**
 * Normalize to the canonical 10-digit national number used for storage.
 *
 * Accepts 10 or 11 digits: an 11-digit number with the NANP country code `1`
 * is reduced to its 10 national digits. Any formatting is stripped and the
 * result is capped at 10 digits so every phone field stores the same shape.
 */
export function normalizeStoredPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";

  // Drop the leading NANP country code when an 11-digit number is entered.
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, PHONE_NATIONAL_DIGITS);
}

/** Strip non-digits, capped at the national length. */
export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, PHONE_NATIONAL_DIGITS);
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

  // 11 digits: keep the leading (country/trunk) digit instead of dropping it.
  if (digits.length === 11) {
    const country = digits.slice(0, 1);
    const national = formatUsNationalDigits(digits.slice(1));
    return hasPlus ? `+${country} ${national}` : `${country}-${national}`;
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

/**
 * Resolve the value shown to users. A provided display value is trusted only
 * when it carries human formatting (spaces, dashes, parentheses); a bare digit
 * string is reformatted so every phone renders consistently in the UI.
 */
export function resolvePhoneDisplayValue(number: string, displayNumber?: string): string {
  const display = displayNumber?.trim();
  if (display && /[^\d+]/.test(display)) return display;
  return formatPhoneForDisplay(number || display || "");
}

/** Whether an API field name represents a phone value. */
export function isPhoneApiField(field: string): boolean {
  const normalized = field.trim().toLowerCase();
  if (normalized === "phone1" || normalized === "phone2") return true;
  if (normalized.endsWith(".phone1") || normalized.endsWith(".phone2")) return true;
  if (normalized.endsWith(".phone")) return true;
  return normalized.includes(".phones.") || normalized.endsWith(".phones.number");
}

/**
 * Digits kept for phone search/filter values.
 * Mixed input keeps digits only (`9f3a` → `93`). Letter-only input becomes `""`.
 * 11-digit NANP values drop a leading `1`, matching stored national numbers.
 * Aligns with EMSYS `sender.phone` / `receivers.phone` digit-stripping.
 */
export function phoneSearchDigits(value: string): string {
  return normalizeStoredPhone(value);
}

/** Normalize a search/filter value based on the target API field. */
export function normalizeApiSearchValueForField(field: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return isPhoneApiField(field) ? phoneSearchDigits(trimmed) : trimmed;
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
