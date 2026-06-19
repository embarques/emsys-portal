"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  onChange: (phones: RecordPhone[]) => void;
};

export function PhoneListEditor({
  idPrefix = "phone",
  phones,
  required = false,
  onChange,
}: PhoneListEditorProps) {
  const entries = phones.length > 0 ? phones : createDefaultRecordPhones();

  function updatePhone(index: number, patch: Partial<RecordPhone>) {
    const next = entries.map((phone, phoneIndex) =>
      phoneIndex === index ? { ...phone, ...patch } : phone,
    );
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

  return (
    <div className="space-y-3">
      {entries.map((phone, index) => (
        <div key={`${idPrefix}-${index}`} className="rounded-lg border border-border/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Phone {index + 1}</p>
            {entries.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removePhone(index)}
              >
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-type-${index}`}>Type</Label>
              <SearchableSelect
                id={`${idPrefix}-type-${index}`}
                value={phone.type}
                onValueChange={(next) => updatePhone(index, { type: next as RecordPhone["type"] })}
                searchPlaceholder="Search types…"
                options={RECORD_PHONE_TYPE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-number-${index}`}>
                Number {required && index === 0 ? <span className="text-destructive">*</span> : null}
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
            Primary phone
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
        Add phone
      </Button>
    </div>
  );
}
