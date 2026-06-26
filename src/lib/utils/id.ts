function createRandomIdFallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function createRandomIdFromBytes(): string | null {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    return null;
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** UUID v4 compatible id — works where `crypto.randomUUID` is unavailable (HTTP, older mobile browsers). */
export function createRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createRandomIdFromBytes() ?? createRandomIdFallback();
}

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/**
 * True when `value` is a 24-character hex Mongo ObjectID.
 *
 * EMSYS stores customer ids as ObjectIDs, but legacy/migrated records can still
 * carry a numeric `oldID`. Filtering an ObjectID API field (e.g. `sender._id`)
 * with a numeric value makes the backend fail with
 * "cannot decode 32-bit integer into an ObjectID", so guard such filters first.
 */
export function isMongoObjectId(value: string | null | undefined): boolean {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value.trim());
}
