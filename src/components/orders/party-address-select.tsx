"use client";

import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCoreAddressLine } from "@/lib/customers/display";
import {
  getCustomerContentAddresses,
  type Customer,
} from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";

type PartyAddressSelectProps = {
  id: string;
  customer: Customer;
  value: number;
  onChange: (index: number) => void;
};

export function PartyAddressSelect({ id, customer, value, onChange }: PartyAddressSelectProps) {
  const { t } = useTranslation();
  const addresses = getCustomerContentAddresses(customer);

  if (addresses.length === 0) return null;

  const resolvedIndex = Math.min(Math.max(value, 0), addresses.length - 1);

  const options = addresses.map((address, index) => ({
    value: String(index),
    label: formatCoreAddressLine(address),
    keywords: [
      address.address1,
      address.city,
      address.state,
      address.zipcode,
      address.country,
    ].filter(Boolean),
    description: address.isPrimary ? t("orders.form.fields.primaryAddress") : undefined,
  }));

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{t("orders.form.fields.address")}</Label>
      <SearchableSelect
        id={id}
        value={String(resolvedIndex)}
        onValueChange={(next) => onChange(Number(next))}
        placeholder={t("orders.form.placeholders.selectAddress")}
        searchPlaceholder={t("orders.form.placeholders.searchAddress")}
        options={options}
        searchable={addresses.length > 1}
      />
    </div>
  );
}
