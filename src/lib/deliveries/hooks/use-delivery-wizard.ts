"use client";

import { useEffect, useRef, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useDeliveryAccess,
  type DeliverTarget,
} from "@/lib/deliveries/hooks/use-deliver-invoice";
import {
  fetchDeliveryReview,
  completeDelivery,
} from "@/lib/deliveries/api/delivery-wizard-api";
import { useDeliveryPhotos } from "@/lib/deliveries/hooks/use-delivery-photos";
import {
  deliveryWizardSchema,
  type DeliveryWizardValues,
} from "@/lib/deliveries/schemas/delivery-wizard.schema";
import { useActiveInvoicePolicies } from "@/lib/invoice-policies/hooks/use-invoice-policies";
import { buildCustomerSignature } from "@/lib/invoices/schemas/customer-signature.schema";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { normalizeApiError } from "@/lib/api/axios";
import { store } from "@/lib/store/store";
import { useTranslation } from "@/lib/i18n";

export function useDeliveryWizard(target: DeliverTarget) {
  const { t } = useTranslation();
  const access = useDeliveryAccess();
  const client = useQueryClient();
  const invoiceId = target.invoiceId ?? "";
  const deliveryId = target.delivery?.id ? String(target.delivery.id) : "";
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [locked, setLocked] = useState(false);
  const saving = useRef(false);
  const submitted = useRef<Parameters<typeof completeDelivery>[2] | null>(null);
  const form = useForm<DeliveryWizardValues>({
    resolver: zodResolver(deliveryWizardSchema),
    defaultValues: {
      barcodeIds: [],
      signerName: "",
      idNumber: "",
      agreed: false,
      signatureDataUrl: "",
    },
  });
  const query = useWorkspaceQuery({
    queryKey: [
      ...queryKeys.deliveries.group(
        access.companyId,
        access.actorId,
        invoiceId,
        deliveryId,
      ),
      "wizard",
    ],
    queryFn: ({ signal }) => fetchDeliveryReview(deliveryId, invoiceId, signal),
    enabled: access.canDeliver && Boolean(invoiceId && deliveryId),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const policies = useActiveInvoicePolicies(access.canDeliver);
  const photos = useDeliveryPhotos(
    invoiceId,
    deliveryId,
    access.companyId,
    requestId,
  );
  const initialized = useRef(false);
  useEffect(() => {
    if (query.data && !initialized.current) {
      form.setValue(
        "barcodeIds",
        query.data.barcodes.map((barcode) => barcode.barcodeId),
      );
      initialized.current = true;
    }
  }, [form, query.data]);
  const mutation = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (values: DeliveryWizardValues) => {
      const auth = store.getState().auth;
      const token = auth.idToken;
      if (
        !access.canDeliver ||
        !query.data ||
        auth.companyId !== access.companyId ||
        photos.hasPending ||
        policies.isPending ||
        policies.isError
      )
        throw new Error(t("deliveries.deliver.unavailable"));
      if ((policies.data?.length ?? 0) > 0 && !values.agreed)
        throw new Error(t("deliveries.deliver.agreementRequired"));
      // Retain the exact submitted payload after an uncertain response; the API UUID
      // makes retrying safe, including when the first completion actually committed.
      const payload = submitted.current ?? {
        requestId,
        barcodeIds: values.barcodeIds,
        documentIds: photos.documentIds,
        policyIds: (policies.data ?? []).map((policy) => policy.id),
        agreed: values.agreed,
        receiverSignature: {
          ...buildCustomerSignature(values.signerName, values.signatureDataUrl),
          idNumber: values.idNumber,
        },
      };
      submitted.current = payload;
      setLocked(true);
      const result = await completeDelivery(deliveryId, invoiceId, payload);
      const current = store.getState().auth;
      if (current.companyId !== access.companyId || current.idToken !== token)
        throw new Error(t("deliveries.deliver.unavailable"));
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.deliveries.assigned() }),
        client.invalidateQueries({
          queryKey: queryKeys.invoices.detail(invoiceId),
        }),
        client.invalidateQueries({
          queryKey: queryKeys.invoices.signatureOptionsPrefix(access.companyId),
        }),
        client.invalidateQueries({ queryKey: queryKeys.barcodes.all }),
        client.invalidateQueries({
          queryKey: ["invoice-documents", access.companyId, invoiceId],
        }),
      ]);
      return result;
    },
  });
  async function next() {
    form.clearErrors("root");
    if (step === 0) {
      if (!(await form.trigger("barcodeIds"))) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      const ids = await photos.upload();
      if (ids !== null) setStep(2);
      return;
    }
    if (step === 2) {
      if (policies.isPending || policies.isError) return;
      if ((policies.data?.length ?? 0) > 0 && !form.getValues("agreed")) {
        form.setError("agreed", {
          message: t("deliveries.deliver.agreementRequired"),
        });
        return;
      }
      if (await form.trigger(["signerName", "idNumber", "signatureDataUrl"]))
        setStep(3);
    }
  }
  async function save(values: DeliveryWizardValues) {
    if (saving.current || finished) return;
    saving.current = true;
    form.clearErrors("root");
    try {
      await mutation.mutateAsync(values);
      setFinished(true);
    } catch (error) {
      const failure = normalizeApiError(error);
      if (failure.status === 409) {
        submitted.current = null;
        setLocked(false);
        setRequestId(crypto.randomUUID());
        form.setValue("signatureDataUrl", "");
        form.setValue("agreed", false);
        const selected = form.getValues("barcodeIds");
        const fresh = await query.refetch();
        if (fresh.data)
          form.setValue(
            "barcodeIds",
            fresh.data.barcodes
              .filter((barcode) => selected.includes(barcode.barcodeId))
              .map((barcode) => barcode.barcodeId),
          );
        setStep(0);
      }
      form.setError("root", { message: failure.message });
    } finally {
      saving.current = false;
      mutation.reset();
    }
  }
  function submit(event?: BaseSyntheticEvent) {
    return form.handleSubmit(save)(event);
  }

  function toggleBarcode(id: string) {
    const ids = form.getValues("barcodeIds");
    form.setValue(
      "barcodeIds",
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
      { shouldValidate: true },
    );
    form.setValue("signatureDataUrl", "");
    form.setValue("agreed", false);
  }
  function fillFromInvoiceReceiver() {
    const receiver = query.data?.receiver;
    if (receiver) {
      form.setValue("signerName", receiver.name, { shouldValidate: true });
      form.setValue("idNumber", receiver.idNumber, { shouldValidate: true });
    }
  }
  return {
    access,
    form,
    query,
    policies,
    photos,
    step,
    next,
    back: () => setStep((current) => Math.max(0, current - 1)),
    submit,
    finished,
    locked,
    toggleBarcode,
    busy: photos.busy || form.formState.isSubmitting || mutation.isPending,
    fillFromInvoiceReceiver,
  };
}
