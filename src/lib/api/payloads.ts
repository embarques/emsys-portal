/**
 * Shared EMSYS API write payload shapes.
 * Canonical examples: API_PAYLOADS.md
 */

export type ApiAddressPayload = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
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

export type AddressInput = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
};

export function buildApiAddressPayload(address: AddressInput): ApiAddressPayload | undefined {
  const payload: ApiAddressPayload = {};
  const entries: [keyof ApiAddressPayload, string | undefined][] = [
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
