"use client";
import { usePinnedEditSnapshot } from "@/lib/forms/use-pinned-edit-snapshot";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { resolveUserBranchCode } from "@/lib/branches/user-branch";
import {
  formatCustomerMutationError,
  isDuplicateCustomerError,
} from "@/lib/customers/customer-create-error";
import { formatFormMutationError, useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import { stashPartyReturnCustomerId } from "@/lib/customers/party-customer-return";
import {
  areCustomerFormValuesEquivalent,
  createEmptyCustomerForm,
  customerToFormValues,
  getDefaultCustomerTypeForBranchCode,
  type CustomerFormValues,
} from "@/lib/customers/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

export function CustomerFormWorkspace({
  tabId,
  mode,
  entityId,
  customerType,
  customerFormIntent,
  focusAddressIndex,
  formNonce,
}: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { formatError, toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { notifyAdded, notifySuccess, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const customerQuery = useCustomer(isEditing ? (entityId ?? null) : null);
  const currentUserQuery = useCurrentUser();
  const branchesQuery = useBranchPicker(200);
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);

  const [formError, setFormError] = useState<string | null>(null);

  const editingCustomer = usePinnedEditSnapshot(entityId ?? "", isEditing ? customerQuery.data : null);
  const isSaving = createCustomerMutation.isPending || updateCustomerMutation.isPending;
  // When opened from an appointment/invoice New or Edit party action, lock the party type.
  const hasPresetCustomerType = customerType != null;

  const userBranch = currentUserQuery.data?.branch;
  const userBranchCode = resolveUserBranchCode(userBranch, branches);
  const userSettled =
    Boolean(currentUserQuery.data) || currentUserQuery.isFetched || currentUserQuery.isError;
  const waitingForBranchDirectory =
    Boolean(userBranch && (userBranch.id > 0 || userBranch.name.trim())) &&
    !userBranchCode &&
    branches.length === 0 &&
    (branchesQuery.isPending || branchesQuery.isFetching);
  // Wait for the signed-in branch before create so USA → sender / DR → receiver is correct.
  const waitingForCreateDefaults =
    !isEditing && !hasPresetCustomerType && (!userSettled || waitingForBranchDirectory);
  const createCustomerType = hasPresetCustomerType
    ? customerType
    : getDefaultCustomerTypeForBranchCode(userBranchCode);

  useEffect(() => {
    if (isEditing && editingCustomer?.name) {
      updateTabLabel(tabId, t("customers.actions.editNamed", { name: editingCustomer.name }));
    }
  }, [editingCustomer?.name, isEditing, tabId, t, updateTabLabel]);

  async function saveCustomer(values: CustomerFormValues) {
    setFormError(null);

    try {
      if (isEditing && editingCustomer) {
        if (areCustomerFormValuesEquivalent(values, customerToFormValues(editingCustomer))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const nextCustomer = await updateCustomerMutation.mutateAsync({
          customerId: editingCustomer.id,
          values,
          originalValues: customerToFormValues(editingCustomer),
        });
        notifyUpdated(t("customers.entity"), nextCustomer.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const nextCustomer = await createCustomerMutation.mutateAsync(values);
      notifyAdded(t("customers.entity"), nextCustomer.name);
      // Opened from appointment/invoice "New" party action: hand the customer
      // back to the parent form.
      if (hasPresetCustomerType) {
        stashPartyReturnCustomerId(nextCustomer.id);
      }
      closeFormTabAndReturn(tabId);
    } catch (mutationError) {
      const { status, category } = formatError(mutationError);
      setFormError(
        formatFormMutationError(mutationError, t, {
          formatConflict: (error) =>
            isDuplicateCustomerError(error)
              ? formatCustomerMutationError(error, t, {
                  mode: isEditing ? "edit" : "create",
                })
              : null,
          hint:
            status === 403 || category === "forbidden"
              ? t("common.errors.permissionHint")
              : undefined,
        }),
      );
    }
  }

  if ((isEditing && customerQuery.isLoading) || waitingForCreateDefaults) {
    return (
      <FormTabShell title={isEditing ? t("customers.form.editTitle") : t("customers.form.addTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("customers.loading.customer")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (customerQuery.isError || !editingCustomer)) {
    const message = customerQuery.isError
      ? toErrorMessage(customerQuery.error)
      : t("customers.form.notFound");
    return (
      <FormTabShell title={t("customers.form.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? t("customers.form.editTitle") : t("customers.form.addTitle")}
      description={
        isEditing && editingCustomer ? editingCustomer.name : t("customers.form.addDescription")
      }
    >
      <CustomerForm
        key={
          isEditing
            ? (editingCustomer?.id ?? "edit")
            : `new-${createCustomerType}-${formNonce ?? 0}`
        }
        initialValues={
          isEditing && editingCustomer
            ? customerToFormValues(editingCustomer)
            : createEmptyCustomerForm(createCustomerType)
        }
        entryNonce={formNonce}
        startWithNewAddress={customerFormIntent === "address"}
        startWithNewPhone={customerFormIntent === "phone"}
        focusAddressIndex={focusAddressIndex}
        isEditing={isEditing}
        lockCustomerType={hasPresetCustomerType}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t("customers.actions.add")
        }
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={saveCustomer}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
