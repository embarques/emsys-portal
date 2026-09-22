export const CUSTOMER_FORM_PARAM = "customer-form";

/** Stay on the originating page so its unsaved appointment/invoice remains mounted. */
export function buildMobileCustomerFormHref(returnHref: string, formId: string): string {
  const url = new URL(returnHref, "https://emsys.local");
  url.searchParams.set(CUSTOMER_FORM_PARAM, formId);
  return `${url.pathname}${url.search}`;
}
