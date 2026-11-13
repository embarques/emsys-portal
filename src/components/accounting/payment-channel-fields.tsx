"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";

import { FieldMessage } from "@/components/forms/field-message";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { findCashPaymentMethod, isCashPaymentMethod, matchPaymentMethod, type AccountingLookup } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PaymentChannel = "cash" | "bank";

type Props = {
  inlineOptionsLimit?: number;
  paymentMethods: AccountingLookup[];
  paymentMethodId?: number;
  paymentMethodName?: string;
  required?: boolean;
  error?: string;
  className?: string;
  /** Rendered beside the segments while Cash is selected (e.g. the cash account). */
  cashField?: ReactNode;
  onMethodChange: (method: AccountingLookup | undefined) => void;
};

/** Cash or bank first; bank then asks which non-cash method moved the money. */
export function PaymentChannelFields({ paymentMethods, paymentMethodId, paymentMethodName, required = false, error, className, cashField, onMethodChange, inlineOptionsLimit }: Props) {
  const { t } = useTranslation();
  const cashMethod = findCashPaymentMethod(paymentMethods);
  const bankMethods = useMemo(() => paymentMethods.filter((method) => !isCashPaymentMethod(method.name)), [paymentMethods]);
  const channel: PaymentChannel =
    (paymentMethodName && !isCashPaymentMethod(paymentMethodName)) || (paymentMethods.length > 0 && !cashMethod) ? "bank" : "cash";
  const lastBankMethodRef = useRef<{ id?: number; name?: string } | null>(channel === "bank" ? { id: paymentMethodId, name: paymentMethodName } : null);
  const pointerChangeRef = useRef(false);
  const [openMethodOnMount, setOpenMethodOnMount] = useState(false);
  const bankOptions = useMemo(
    () => withPinnedSelectOption(
      bankMethods.map((method) => ({ value: String(method.id), label: method.name, keywords: [method.name] })),
      channel === "bank" ? paymentMethodId : undefined,
      channel === "bank" ? paymentMethodName : undefined,
    ),
    [bankMethods, channel, paymentMethodId, paymentMethodName],
  );

  function changeChannel(next: PaymentChannel) {
    const fromPointer = pointerChangeRef.current;
    pointerChangeRef.current = false;
    if (next === "cash") {
      setOpenMethodOnMount(false);
      onMethodChange(cashMethod);
      return;
    }
    const remembered = lastBankMethodRef.current;
    const method = (remembered && matchPaymentMethod(bankMethods, remembered.id, remembered.name)) ?? bankMethods[0];
    // Pointer users see the method list right away; keyboard users stay on the segments.
    setOpenMethodOnMount(fromPointer);
    onMethodChange(method);
  }

  return (
    <div className={cn("grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2", className)}>
      <div className="min-w-0 space-y-2">
        <Label id="journal-payment-channel-label">{t("accounting.dailyIncome.form.fields.paymentChannel")}</Label>
        <div
          data-enter-navigation="field"
          onPointerDownCapture={() => { pointerChangeRef.current = true; }}
          onKeyDownCapture={() => { pointerChangeRef.current = false; }}
        >
          <SegmentedControl<PaymentChannel>
            id="journal-payment-channel"
            aria-labelledby="journal-payment-channel-label"
            value={channel}
            onValueChange={changeChannel}
            options={[
              { value: "cash", label: t("accounting.dailyIncome.form.fields.paymentChannelCash"), disabled: !cashMethod },
              { value: "bank", label: t("accounting.dailyIncome.form.fields.paymentChannelBank"), disabled: bankMethods.length === 0 },
            ]}
          />
        </div>
      </div>
      {channel === "bank" ? (
        <div className="min-w-0 space-y-2">
          <Label htmlFor="journal-payment">
            {t("accounting.dailyIncome.form.fields.paymentMethod")}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <SearchableSelect
            inlineOptionsLimit={inlineOptionsLimit}
            id="journal-payment"
            value={paymentMethodId != null ? String(paymentMethodId) : ""}
            onValueChange={(next) => {
              const method = bankMethods.find((item) => item.id === Number(next));
              if (method) lastBankMethodRef.current = { id: method.id, name: method.name };
              onMethodChange(method);
            }}
            placeholder={t("accounting.dailyIncome.form.placeholders.selectPaymentMethod")}
            searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchPaymentMethods")}
            autoFocus={openMethodOnMount}
            defaultOpen={openMethodOnMount}
            mobileSheet
            options={bankOptions}
            aria-invalid={Boolean(error)}
          />
          <FieldMessage error={error} />
        </div>
      ) : cashField}
    </div>
  );
}
