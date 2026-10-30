"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { createLoanFormSchema } from "./schemas";
import type { LoanCreateValues } from "./types";

export function useCreateLoanForm(onSubmit: (values: LoanCreateValues) => Promise<void>, pending: boolean) {
  const { t } = useTranslation();
  const schema = useMemo(() => createLoanFormSchema(t), [t]);
  const [step, setStep] = useState(1);
  const [closeoutReady, setCloseoutReady] = useState(false);
  const submitting = useRef(false);
  const form = useForm<LoanCreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: 0, loanAccountId: 0, sourceAccountId: 0, principalAmount: 0,
      transactionDate: new Date().toISOString().slice(0, 10), referenceNumber: "", description: "",
    },
  });
  const busy = pending || form.formState.isSubmitting;
  async function advance() {
    if (busy || submitting.current) return;
    if (step === 1) {
      if (await form.trigger("employeeId", { shouldFocus: true })) setStep(2);
      return;
    }
    if (step === 2) {
      if (await form.trigger(undefined, { shouldFocus: true }) && closeoutReady) setStep(3);
      return;
    }
    await form.handleSubmit(async values => {
      if (submitting.current || pending || !closeoutReady) return;
      submitting.current = true;
      form.clearErrors("root.server");
      try { await onSubmit(values); }
      catch (error) { form.setError("root.server", { message: normalizeApiError(error).message }); }
      finally { submitting.current = false; }
    })();
  }
  return { form, step, setStep, busy, closeoutReady, setCloseoutReady, advance };
}
