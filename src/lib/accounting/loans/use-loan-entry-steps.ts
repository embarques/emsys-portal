"use client";

import { useRef, useState, type FormEvent } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/** Validates each loan stage while keeping the same form and draft mounted. */
export function useLoanEntrySteps<T extends FieldValues>(form: UseFormReturn<T>, assignmentFields: Path<T>[], enabled: boolean) {
  const [step, setStep] = useState(1);
  const advancing = useRef(false);

  async function advance(event: FormEvent<HTMLFormElement>, save: (event: FormEvent<HTMLFormElement>) => Promise<void>) {
    event.preventDefault();
    if (advancing.current) return;
    advancing.current = true;
    try {
      if (!enabled) return await save(event);
      if (step === 1) {
        if (await form.trigger(assignmentFields, { shouldFocus: true })) setStep(2);
      } else if (step === 2) {
        if (await form.trigger(undefined, { shouldFocus: true })) setStep(3);
        else if (assignmentFields.some((field) => form.getFieldState(field).error)) setStep(1);
      } else {
        const valid = await form.trigger();
        if (valid) await save(event);
        else setStep(assignmentFields.some((field) => form.getFieldState(field).error) ? 1 : 2);
      }
    } finally {
      advancing.current = false;
    }
  }

  return { step, setStep, advance };
}
