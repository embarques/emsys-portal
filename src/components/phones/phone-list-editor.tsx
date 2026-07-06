"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  createDefaultRecordPhones,
  createEmptyRecordPhone,
  ensureSinglePrimaryPhone,
} from "@/lib/phones/phones";
import { RECORD_PHONE_TYPE_OPTIONS, type RecordPhone } from "@/lib/phones/types";

type PhoneListEditorProps = {
  idPrefix?: string;
  phones: RecordPhone[];
  required?: boolean;
  /** Dense single-row layout used inside compact forms. */
  compact?: boolean;
  onChange: (phones: RecordPhone[]) => void;
};

export function PhoneListEditor({
  idPrefix = "phone",
  phones,
  required = false,
  compact = false,
  onChange,
}: PhoneListEditorProps) {
  const { t } = useTranslation();
  const entries = phones.length > 0 ? phones : createDefaultRecordPhones();

  const phoneTypeOptions = useMemo(
    () =>
      RECORD_PHONE_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(`phones.types.${option.value}`),
      })),
    [t],
  );

  function updatePhone(index: number, patch: Partial<RecordPhone>) {
    const next = entries.map((phone, phoneIndex) => {
      if (phoneIndex === index) {
        return { ...phone, ...patch };
      }
      // When marking a phone as primary, clear the flag on all others so the
      // newly selected one wins (avoids reverting to the first existing primary).
      return patch.isPrimary ? { ...phone, isPrimary: false } : phone;
    });
    onChange(patch.isPrimary ? ensureSinglePrimaryPhone(next) : next);
  }

  function addPhone() {
    onChange([...entries, createEmptyRecordPhone(false)]);
  }

  function removePhone(index: number) {
    if (entries.length <= 1) {
      onChange(createDefaultRecordPhones());
      return;
    }

    onChange(ensureSinglePrimaryPhone(entries.filter((_, phoneIndex) => phoneIndex !== index)));
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {entries.map((phone, index) => {
          const isOnly = entries.length <= 1;

          return (
            <div key={`${idPrefix}-${index}`} className="flex items-center gap-2">
              <div className="w-28 shrink-0 sm:w-32">
                <SearchableSelect
                  aria-label={t("phones.aria.type", { index: index + 1 })}
                  value={phone.type}
                  onValueChange={(next) => updatePhone(index, { type: next as RecordPhone["type"] })}
                  searchPlaceholder={t("phones.searchTypes")}
                  options={phoneTypeOptions}
                />
              </div>

              <div className="min-w-0 flex-1">
                <PhoneInput
                  aria-label={t("phones.aria.number", { index: index + 1 })}
                  value={phone.number}
                  onChange={(nextValue) => updatePhone(index, { number: nextValue })}
                  required={required && index === 0}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={phone.isPrimary}
                title={phone.isPrimary ? t("phones.primary") : t("phones.setPrimary")}
                className={cn(
                  "shrink-0",
                  phone.isPrimary
                    ? "text-amber-500 hover:text-amber-500"
                    : "text-muted-foreground",
                )}
                onClick={() => updatePhone(index, { isPrimary: true })}
              >
                <Star className={cn("size-4", phone.isPrimary && "fill-current")} />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={t("phones.remove")}
                disabled={isOnly}
                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removePhone(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
          onClick={addPhone}
        >
          <Plus className="size-4" />
          {t("phones.add")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((phone, index) => (
        <div key={`${idPrefix}-${index}`} className="rounded-lg border border-border/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{t("phones.label", { index: index + 1 })}</p>
            {entries.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removePhone(index)}
              >
                <Trash2 className="size-4" />
                {t("phones.removeButton")}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-type-${index}`}>{t("phones.fieldType")}</Label>
              <SearchableSelect
                id={`${idPrefix}-type-${index}`}
                value={phone.type}
                onValueChange={(next) => updatePhone(index, { type: next as RecordPhone["type"] })}
                searchPlaceholder={t("phones.searchTypes")}
                options={phoneTypeOptions}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-number-${index}`}>
                {t("phones.fieldNumber")}{" "}
                {required && index === 0 ? <span className="text-destructive">*</span> : null}
              </Label>
              <PhoneInput
                id={`${idPrefix}-number-${index}`}
                value={phone.number}
                onChange={(nextValue) => updatePhone(index, { number: nextValue })}
                required={required && index === 0}
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${idPrefix}-primary`}
              checked={phone.isPrimary}
              onChange={() => updatePhone(index, { isPrimary: true })}
            />
            {t("phones.primary")}
          </label>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
        onClick={addPhone}
      >
        <Plus className="size-4" />
        {t("phones.add")}
      </Button>
    </div>
  );
}
