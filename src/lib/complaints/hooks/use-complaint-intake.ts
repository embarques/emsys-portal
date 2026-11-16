"use client";

import { useRef, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useComplaintMutations } from "@/lib/complaints/hooks/use-complaints";
import { complaintIntakeFormSchema } from "@/lib/complaints/schemas/complaint.schema";
import {
  createEmptyComplaintIntakeForm,
  type Complaint,
  type ComplaintCategory,
  type ComplaintIntakeFormValues,
} from "@/lib/complaints/types";
import { buildComplaintDetails, buildComplaintIntakeRequest } from "@/lib/complaints/utils/intake";
import { useTranslation } from "@/lib/i18n";

export function useComplaintIntake(
  categories: readonly ComplaintCategory[],
  options: { onCreated?: (complaint: Complaint) => void } = {},
) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const { create } = useComplaintMutations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const form = useForm<ComplaintIntakeFormValues>({
    resolver: zodResolver(complaintIntakeFormSchema),
    defaultValues: createEmptyComplaintIntakeForm(),
  });
  const busy = create.isPending;

  function start() {
    form.reset(createEmptyComplaintIntakeForm());
    setError(null);
    create.reset();
    setOpen(true);
  }

  /** Detail fields belong to one category's schema; switching categories starts them over. */
  function changeCategory(key: string) {
    form.setValue("category", key, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    form.setValue("details", {}, { shouldDirty: true });
    form.clearErrors("details");
  }

  async function submit(values: ComplaintIntakeFormValues) {
    if (submitting.current) return;
    const category = categories.find((item) => item.key === values.category);
    if (!category) {
      form.setError("category", { message: "common.validation.required" });
      return;
    }
    const { details, errors } = buildComplaintDetails(category, values.details);
    if (errors.length) {
      for (const detailError of errors) form.setError(`details.${detailError.key}`, { message: detailError.message });
      return;
    }

    submitting.current = true;
    setError(null);
    try {
      const created = await create.mutateAsync(buildComplaintIntakeRequest(values, details));
      feedback.notifyAdded(t("complaints.entity"), created.number);
      setOpen(false);
      options.onCreated?.(created);
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    } finally {
      submitting.current = false;
    }
  }

  function save(event?: BaseSyntheticEvent) {
    return form.handleSubmit(submit)(event);
  }

  return {
    form,
    open,
    error,
    busy,
    start,
    save,
    changeCategory,
    selectedCategory: (key: string) => categories.find((item) => item.key === key),
    setOpen: (value: boolean) => {
      if (!busy) setOpen(value);
    },
  };
}
