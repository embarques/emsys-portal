import { formatPhoneForDisplay, normalizeStoredPhone } from "@/lib/utils/phone";

import {
  RECORD_PHONE_TYPE_OPTIONS,
  type RecordPhone,
  type RecordPhoneType,
} from "./types";

type ApiPhoneRaw = {
  type?: string;
  number?: string;
  isPrimary?: boolean;
};

export type LegacyPhoneSource = {
  phones?: unknown;
  phone1?: unknown;
  phone2?: unknown;
};

export function createEmptyRecordPhone(isPrimary = false): RecordPhone {
  return { type: "mobile", number: "", isPrimary };
}

export function createDefaultRecordPhones(): RecordPhone[] {
  return [createEmptyRecordPhone(true)];
}

function coercePhoneType(value: unknown): RecordPhoneType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "home") return "home";
  if (normalized === "other") return "other";
  return "mobile";
}

function normalizeApiPhoneEntry(raw: unknown): RecordPhone | null {
  if (!raw || typeof raw !== "object") return null;

  const entry = raw as ApiPhoneRaw;
  const number = normalizeStoredPhone(String(entry.number ?? ""));
  if (!number) return null;

  return {
    type: coercePhoneType(entry.type),
    number,
    isPrimary: Boolean(entry.isPrimary),
  };
}

function legacyPhoneEntries(source: LegacyPhoneSource): RecordPhone[] {
  const phones: RecordPhone[] = [];
  const phone1Raw = source.phone1;
  let phone1 = "";

  if (Array.isArray(phone1Raw)) {
    phone1 = normalizeStoredPhone(String(phone1Raw.find(Boolean) ?? ""));
  } else {
    phone1 = normalizeStoredPhone(String(phone1Raw ?? ""));
  }

  const phone2 = normalizeStoredPhone(String(source.phone2 ?? ""));

  if (phone1) {
    phones.push({ type: "mobile", number: phone1, isPrimary: true });
  }

  if (phone2) {
    phones.push({ type: "business", number: phone2, isPrimary: phones.length === 0 });
  }

  return phones;
}

export function ensureSinglePrimaryPhone(phones: RecordPhone[]): RecordPhone[] {
  if (phones.length === 0) return [];

  const primaryIndex = phones.findIndex((phone) => phone.isPrimary);
  const index = primaryIndex >= 0 ? primaryIndex : 0;

  return phones.map((phone, phoneIndex) => ({
    ...phone,
    isPrimary: phoneIndex === index,
  }));
}

export function normalizeRecordPhonesFromApi(source: LegacyPhoneSource): RecordPhone[] {
  if (Array.isArray(source.phones)) {
    const parsed = source.phones
      .map((entry) => normalizeApiPhoneEntry(entry))
      .filter((entry): entry is RecordPhone => entry != null);

    if (parsed.length > 0) {
      return ensureSinglePrimaryPhone(parsed);
    }
  }

  const legacy = legacyPhoneEntries(source);
  return legacy.length > 0 ? ensureSinglePrimaryPhone(legacy) : [];
}

export function normalizeRecordPhonesFormValues(phones: RecordPhone[]): RecordPhone[] {
  const normalized = phones
    .map((phone) => ({
      type: coercePhoneType(phone.type),
      number: normalizeStoredPhone(phone.number),
      isPrimary: phone.isPrimary,
    }))
    .filter((phone) => phone.number);

  return normalized.length > 0 ? ensureSinglePrimaryPhone(normalized) : createDefaultRecordPhones();
}

export function validateRecordPhones(
  phones: RecordPhone[],
  options: { required?: boolean } = {},
): void {
  const normalized = phones.filter((phone) => phone.number.trim());

  if (options.required !== false && normalized.length === 0) {
    throw new Error("At least one phone number is required.");
  }
}

export function buildApiPhonesPayload(phones: RecordPhone[]): RecordPhone[] {
  return normalizeRecordPhonesFormValues(phones).map(({ type, number, isPrimary }) => ({
    type,
    number,
    isPrimary,
  }));
}

export function getPrimaryRecordPhone(phones: RecordPhone[]): RecordPhone | undefined {
  return (
    phones.find((phone) => phone.isPrimary && phone.number.trim()) ??
    phones.find((phone) => phone.number.trim())
  );
}

export function getPrimaryPhoneNumber(phones: RecordPhone[]): string {
  return getPrimaryRecordPhone(phones)?.number ?? "";
}

export function getOrderedRecordPhones(phones: RecordPhone[]): RecordPhone[] {
  const withNumbers = phones.filter((phone) => phone.number.trim());
  const primary = withNumbers.filter((phone) => phone.isPrimary);
  const secondary = withNumbers.filter((phone) => !phone.isPrimary);

  return [...primary, ...secondary];
}

export function getPhoneAtDisplayIndex(phones: RecordPhone[], index: number): string {
  return getOrderedRecordPhones(phones)[index]?.number ?? "";
}

export function formatRecordPhoneTypeLabel(type: RecordPhoneType): string {
  return RECORD_PHONE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function formatRecordPhoneList(phones: RecordPhone[]): string {
  const entries = getOrderedRecordPhones(phones);
  if (entries.length === 0) return "—";

  return entries
    .map((phone) => {
      const label = formatRecordPhoneTypeLabel(phone.type);
      const suffix = phone.isPrimary ? " (primary)" : "";
      return `${label}: ${formatPhoneForDisplay(phone.number)}${suffix}`;
    })
    .join(" · ");
}

export function formatRecordPhonesCompact(phones: RecordPhone[]): string {
  const entries = getOrderedRecordPhones(phones);
  if (entries.length === 0) return "—";

  const first = entries[0];
  const formatted = formatPhoneForDisplay(first.number);
  const suffix = entries.length > 1 ? ` (+${entries.length - 1})` : "";
  return `${formatted}${suffix}`;
}
