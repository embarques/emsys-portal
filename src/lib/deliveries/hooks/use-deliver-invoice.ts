"use client";

import { useRef, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { useAppSelector } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { fetchInvoiceById, patchInvoiceEmbeddedBarcodes } from "@/lib/invoices/api/invoices-api";
import { saveInvoiceReceiverSignature } from "@/lib/invoices/api/invoice-signatures-api";
import { buildCustomerSignature } from "@/lib/invoices/schemas/customer-signature.schema";
import { useDeliveryDocuments } from "@/lib/invoices/hooks/use-delivery-documents";
import { useActiveInvoicePolicies } from "@/lib/invoice-policies/hooks/use-invoice-policies";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import {
  buildDeliveryStatusPatches,
  deliveryGroupFingerprint,
  resolveDeliveryGroup,
} from "@/lib/deliveries/utils/delivery-group";
import type { Barcode } from "@/lib/barcodes/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";

export type DeliverTarget = Pick<Barcode, "invoiceId" | "barcodeId" | "number" | "route">;

export function useDeliveryAccess() {
  const { hasPermission, isAuthenticated, user, email } = useAuth();
  const companyId = useAppSelector((state) => state.auth.companyId);
  const has = (permission: Permission) => hasPermission(permission.name, permission.resourceType);
  const session = isAuthenticated && Boolean(companyId);
  return {
    companyId,
    actorId: user?.uid || email || "",
    canList: session && has(PERMISSIONS.deliveriesView),
    // Status changes and delivery documents are written on the invoice.
    canDeliver: session
      && has(PERMISSIONS.deliveriesUpdate)
      && has(PERMISSIONS.invoicesView)
      && has(PERMISSIONS.invoicesUpdate),
  };
}

export function useDeliverInvoice(target: DeliverTarget, onDelivered: () => void) {
  const { t } = useTranslation();
  const access = useDeliveryAccess();
  const client = useQueryClient();
  const saving = useRef(false);
  const signatureSavedRef = useRef(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const statusOptions = useBarcodeStatusOptions();
  const policies = useActiveInvoicePolicies(access.canDeliver);
  const schema = z.object({
    statusId: z.string().min(1, t("deliveries.deliver.statusRequired")),
    agreed: z.boolean(),
    signerName: z.string().trim().min(1, t("deliveries.deliver.required")),
    idNumber: z.string().trim().min(1, t("deliveries.deliver.required")),
    signatureDataUrl: z.string().startsWith("data:image/png;base64,", t("deliveries.deliver.signatureRequired")),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { statusId: "", agreed: false, signerName: "", idNumber: "", signatureDataUrl: "" },
  });
  const invoiceId = target.invoiceId ?? "";
  const routeId = target.route?.id ?? "";
  const key = queryKeys.deliveries.group(access.companyId, access.actorId, invoiceId, routeId);
  const query = useWorkspaceQuery({
    queryKey: key,
    queryFn: async ({ signal }) => resolveDeliveryGroup(target, await fetchInvoiceById(invoiceId, signal)),
    enabled: access.canDeliver && Boolean(invoiceId && routeId),
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const documents = useDeliveryDocuments(invoiceId, access.companyId,
    access.canDeliver && Boolean(query.data?.containerId));
  const invoiceReceiver = query.data?.invoiceReceiver ?? { name: "", idNumber: "" };
  function fillFromInvoiceReceiver() {
    const options = { shouldDirty: true, shouldValidate: true } as const;
    if (invoiceReceiver.name) form.setValue("signerName", invoiceReceiver.name, options);
    if (invoiceReceiver.idNumber) form.setValue("idNumber", invoiceReceiver.idNumber, options);
  }
  const requiresAgreement = (policies.data?.length ?? 0) > 0;
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (values: Values) => {
      const reviewed = query.data;
      if (!access.canDeliver || !reviewed || access.companyId !== store.getState().auth.companyId) {
        throw new Error(t("deliveries.deliver.unavailable"));
      }
      const status = statusOptions.find((option) => String(option.id) === values.statusId);
      if (!status) throw new Error(t("deliveries.deliver.statusRequired"));
      // Recheck assignments before signing for the reviewed set of merchandise.
      const sessionToken = store.getState().auth.idToken;
      const current = await fetchInvoiceById(reviewed.invoiceId);
      const group = resolveDeliveryGroup(target, current);
      if (!group || deliveryGroupFingerprint(group) !== deliveryGroupFingerprint(reviewed)) {
        if (!signatureSavedRef.current) form.setValue("signatureDataUrl", "");
        client.setQueryData(key, group);
        throw new Error(t("deliveries.deliver.changed"));
      }
      if (access.companyId !== store.getState().auth.companyId || sessionToken !== store.getState().auth.idToken) {
        throw new Error(t("deliveries.deliver.unavailable"));
      }
      // A status failure must not resend the signature: the API would store it again as a document.
      if (!signatureSavedRef.current) {
        await saveInvoiceReceiverSignature({
          invoiceId: reviewed.invoiceId,
          dailyRouteId: reviewed.routeId,
          receiverSignature: { ...buildCustomerSignature(values.signerName, values.signatureDataUrl), idNumber: values.idNumber },
        });
        signatureSavedRef.current = true;
        setSignatureSaved(true);
      }
      await patchInvoiceEmbeddedBarcodes(group.invoiceId, buildDeliveryStatusPatches(group, { id: status.id, name: status.name }));
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoiceId) }),
        client.invalidateQueries({ queryKey: queryKeys.deliveries.assigned() }),
        client.invalidateQueries({ queryKey: queryKeys.barcodes.all }),
      ]);
    },
  });
  async function save(values: Values) {
    if (saving.current || documents.busy || documents.hasPending) return;
    if (requiresAgreement && !values.agreed) {
      form.setError("agreed", { message: t("deliveries.deliver.agreementRequired") });
      return;
    }
    saving.current = true;
    form.clearErrors("root");
    try {
      await mutation.mutateAsync(values);
      form.reset();
      onDelivered();
    } catch (error) {
      form.setError("root", { message: normalizeApiError(error).message });
    } finally {
      saving.current = false;
      mutation.reset();
    }
  }
  const submit = (event?: BaseSyntheticEvent) => form.handleSubmit(save)(event);
  return {
    form,
    query,
    policies,
    statusOptions,
    submit,
    documents,
    signatureSaved,
    invoiceReceiver,
    fillFromInvoiceReceiver,
    canDeliver: access.canDeliver,
    reviewKey: query.data ? deliveryGroupFingerprint(query.data) : "",
    busy: form.formState.isSubmitting || mutation.isPending || documents.busy,
  };
}
