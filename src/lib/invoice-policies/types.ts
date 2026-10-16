export type InvoicePolicy = {
  id: number;
  title: string;
  body: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvoicePolicyFormValues = {
  title: string;
  body: string;
  sortOrder: number;
  active: boolean;
};

export function policyToFormValues(policy: InvoicePolicy): InvoicePolicyFormValues {
  return {
    title: policy.title,
    body: policy.body,
    sortOrder: policy.sortOrder,
    active: policy.active,
  };
}

export function createEmptyPolicyForm(): InvoicePolicyFormValues {
  return {
    title: "",
    body: "",
    sortOrder: 0,
    active: true,
  };
}
