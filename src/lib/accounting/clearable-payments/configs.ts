import { API_ENDPOINTS } from "@/lib/api/endpoints";

export type ClearablePaymentMethodId = "zelle" | "deposit" | "creditCard";

export type ClearablePaymentMethodConfig = {
  id: ClearablePaymentMethodId;
  endpoint: string;
  /** i18n namespace under accounting.*, e.g. "zellePayments" */
  i18nKey: "zellePayments" | "deposits" | "creditCardPayments";
  columnStorageKey: string;
  href: string;
  queryKeySegment: string;
};

export const ZELLE_PAYMENTS_CONFIG: ClearablePaymentMethodConfig = {
  id: "zelle",
  endpoint: API_ENDPOINTS.ACCOUNTING_ZELLE_PAYMENTS,
  i18nKey: "zellePayments",
  columnStorageKey: "accounting-zelle-payments-v1",
  href: "/accounting/zelle",
  queryKeySegment: "zelle-payments",
};

export const DEPOSITS_CONFIG: ClearablePaymentMethodConfig = {
  id: "deposit",
  endpoint: API_ENDPOINTS.ACCOUNTING_DEPOSITS,
  i18nKey: "deposits",
  columnStorageKey: "accounting-deposits-v1",
  href: "/accounting/deposits",
  queryKeySegment: "deposits",
};

export const CREDIT_CARD_PAYMENTS_CONFIG: ClearablePaymentMethodConfig = {
  id: "creditCard",
  endpoint: API_ENDPOINTS.ACCOUNTING_CREDIT_CARD_PAYMENTS,
  i18nKey: "creditCardPayments",
  columnStorageKey: "accounting-credit-card-payments-v1",
  href: "/accounting/credit-cards",
  queryKeySegment: "credit-card-payments",
};

export const CLEARABLE_PAYMENT_METHOD_CONFIGS = [
  ZELLE_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  CREDIT_CARD_PAYMENTS_CONFIG,
] as const;
