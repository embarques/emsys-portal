import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

export type ClearablePaymentMethodId = "zelle" | "deposit" | "creditCard";

export type ClearablePaymentPermissions = {
  list: Permission;
  view: Permission;
  create: Permission;
  update: Permission;
  delete: Permission;
};

export type ClearablePaymentMethodConfig = {
  id: ClearablePaymentMethodId;
  endpoint: string;
  /** i18n namespace under accounting.*, e.g. "zellePayments" */
  i18nKey: "zellePayments" | "deposits" | "creditCardPayments";
  columnStorageKey: string;
  href: string;
  queryKeySegment: string;
  permissions: ClearablePaymentPermissions;
};

export const ZELLE_PAYMENTS_CONFIG: ClearablePaymentMethodConfig = {
  id: "zelle",
  endpoint: API_ENDPOINTS.ACCOUNTING_ZELLE_PAYMENTS,
  i18nKey: "zellePayments",
  columnStorageKey: "accounting-zelle-payments-v1",
  href: "/accounting/zelle",
  queryKeySegment: "zelle-payments",
  permissions: {
    list: PERMISSIONS.zellePaymentsList,
    view: PERMISSIONS.zellePaymentsView,
    create: PERMISSIONS.zellePaymentsCreate,
    update: PERMISSIONS.zellePaymentsUpdate,
    delete: PERMISSIONS.zellePaymentsDelete,
  },
};

export const DEPOSITS_CONFIG: ClearablePaymentMethodConfig = {
  id: "deposit",
  endpoint: API_ENDPOINTS.ACCOUNTING_DEPOSITS,
  i18nKey: "deposits",
  columnStorageKey: "accounting-deposits-v1",
  href: "/accounting/deposits",
  queryKeySegment: "deposits",
  permissions: {
    list: PERMISSIONS.depositsList,
    view: PERMISSIONS.depositsView,
    create: PERMISSIONS.depositsCreate,
    update: PERMISSIONS.depositsUpdate,
    delete: PERMISSIONS.depositsDelete,
  },
};

export const CREDIT_CARD_PAYMENTS_CONFIG: ClearablePaymentMethodConfig = {
  id: "creditCard",
  endpoint: API_ENDPOINTS.ACCOUNTING_CREDIT_CARD_PAYMENTS,
  i18nKey: "creditCardPayments",
  columnStorageKey: "accounting-credit-card-payments-v1",
  href: "/accounting/credit-cards",
  queryKeySegment: "credit-card-payments",
  permissions: {
    list: PERMISSIONS.creditCardPaymentsList,
    view: PERMISSIONS.creditCardPaymentsView,
    create: PERMISSIONS.creditCardPaymentsCreate,
    update: PERMISSIONS.creditCardPaymentsUpdate,
    delete: PERMISSIONS.creditCardPaymentsDelete,
  },
};

export const CLEARABLE_PAYMENT_METHOD_CONFIGS = [
  ZELLE_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  CREDIT_CARD_PAYMENTS_CONFIG,
] as const;
