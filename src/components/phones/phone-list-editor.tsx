"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  createDefaultRecordPhones,
  createEmptyRecordPhone,
  ensureSinglePrimaryPhone,
} from "@/lib/phones/phones";
import { RECORD_PHONE_TYPE_OPTIONS, type RecordPhone } from "@/lib/phones/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
              <Button type="button" variant="ghost" size="sm" onClick={() => removePhone(index)}>
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-type-${index}`}>Type</Label>
              <select
                id={`${idPrefix}-type-${index}`}
                className={selectClassName}
                value={phone.type}
                onChange={(event) => updatePhone(index, { type: event.target.value as RecordPhone["type"] })}
              >
                {RECORD_PHONE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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

      <Button type="button" variant="outline" size="sm" onClick={addPhone}>
        <Plus className="size-4" />
        Add phone
      </Button>
    </div>
  );
}
