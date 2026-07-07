/**
 * Shared EMSYS API write payload shapes.
 * Canonical examples: API_PAYLOADS.md
 */

/** GeoJSON Point — coordinates use GeoJSON order: [longitude, latitude]. */
export type ApiGeoLocationPayload = {
  type: "Point";
  coordinates: [number, number];
};

/** Google verification metadata (snake_case per EMSYS API). */
export type ApiAddressVerificationPayload = {
  is_verified: boolean;
  verified_at?: string;
};

export type ApiAddressPayload = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  location?: ApiGeoLocationPayload;
  verification?: ApiAddressVerificationPayload;
  isPrimary?: boolean;
};

/** Branch reference for employees and pickups (`id` + `code`). */
export type ApiBranchRefPayload = {
  id: number;
  code: string;
};

/** BranchDTO for customers and users. */
export type ApiBranchDtoPayload = {
  id: number;
  code: string;
  name?: string;
};

export type ApiRoleRefPayload = {
  id: number;
  name?: string;
  active?: boolean;
};

export type ApiEntityRefPayload = {
  id: number | string;
  name?: string;
};

export type ApiBranchSettingsPayload = {
  labelPrefix?: string;
  roundDecimalPlaces?: number;
  defaultLabelStatus?: number;
  invoiceCreatedThruIncomeStatement?: boolean;
  printLabelCount?: boolean;
  imageResampleBy?: number;
  s3Profile?: string;
  s3BucketName?: string;
  s3BucketFolder?: string;
  s3ShareLinkExpireMinutes?: number;
};

export type AddressLocationInput = {
  type: "Point";
  coordinates: [number, number];
} | null;

export type AddressVerificationInput = {
  isVerified: boolean;
  verifiedAt?: string;
} | null;

export type AddressInput = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  location?: AddressLocationInput;
  verification?: AddressVerificationInput;
};

export function buildApiGeoLocationPayload(
  location: AddressLocationInput,
): ApiGeoLocationPayload | undefined {
  if (!location || location.type !== "Point") return undefined;
  const [longitude, latitude] = location.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return undefined;
  return { type: "Point", coordinates: [longitude, latitude] };
}

export function buildApiAddressVerificationPayload(
  verification: AddressVerificationInput,
): ApiAddressVerificationPayload | undefined {
  if (!verification) return undefined;
  const payload: ApiAddressVerificationPayload = { is_verified: verification.isVerified };
  const verifiedAt = verification.verifiedAt?.trim();
  if (verifiedAt) {
    payload.verified_at = verifiedAt;
  }
  return payload;
}

type ApiAddressStringField =
  | "address1"
  | "address2"
  | "apartment"
  | "city"
  | "state"
  | "zipcode"
  | "country";

export function buildApiAddressPayload(address: AddressInput): ApiAddressPayload | undefined {
  const payload: ApiAddressPayload = {};
  const entries: [ApiAddressStringField, string | undefined][] = [
    ["address1", address.address1?.trim()],
    ["address2", address.address2?.trim()],
    ["apartment", address.apartment?.trim()],
    ["city", address.city?.trim()],
    ["state", address.state?.trim()],
    ["zipcode", address.zipcode?.trim()],
    ["country", address.country?.trim()],
  ];

  for (const [key, value] of entries) {
    if (value) {
      payload[key] = value;
    }
  }

  const location = buildApiGeoLocationPayload(address.location ?? null);
  if (location) {
    payload.location = location;
  }

  const verification = buildApiAddressVerificationPayload(address.verification ?? null);
  if (verification) {
    payload.verification = verification;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}

export function buildApiBranchRef(branch: { id: number; code?: string }): ApiBranchRefPayload {
  return {
    id: branch.id,
    code: branch.code?.trim() ?? "",
  };
}

export function buildApiBranchDto(branch: {
  id: number;
  code?: string;
  name?: string;
}): ApiBranchDtoPayload {
  const payload: ApiBranchDtoPayload = {
    id: branch.id,
    code: branch.code?.trim() ?? "",
  };

  const name = branch.name?.trim();
  if (name) {
    payload.name = name;
  }

  return payload;
}

export function buildApiRoleRef(role: {
  id: number;
  name?: string;
  active?: boolean;
}): ApiRoleRefPayload {
  const payload: ApiRoleRefPayload = { id: role.id };

  const name = role.name?.trim();
  if (name) {
    payload.name = name;
  }

  if (role.active !== undefined) {
    payload.active = role.active;
  }

  return payload;
}
