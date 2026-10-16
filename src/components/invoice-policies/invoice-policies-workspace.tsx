"use client";

import { formatAuditDateTime } from "@/lib/audit/display";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { InvoicePolicyDialog } from "@/components/invoice-policies/invoice-policy-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { normalizeApiError } from "@/lib/api/axios";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useInvoicePolicyWorkspace } from "@/lib/invoice-policies/hooks/use-invoice-policy-workspace";
import { useTranslation } from "@/lib/i18n";

export function InvoicePoliciesWorkspace() {
  const { t } = useTranslation();
  const state = useInvoicePolicyWorkspace();

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("invoicePolicies.title")}
        description={t("invoicePolicies.description")}
        actions={
          <PermissionGuard permission={PERMISSIONS.invoicePoliciesCreate}>
            <Button onClick={() => state.edit(null)}>
              <Plus className="size-4" />
              {t("invoicePolicies.add")}
            </Button>
          </PermissionGuard>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <p className="text-sm text-muted-foreground">{t("invoicePolicies.tableHint")}</p>
        </CardHeader>

        {state.query.isLoading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : state.query.isError ? (
          <div className="space-y-3 border-b px-6 py-3">
            <p role="alert" className="text-sm text-destructive">
              {normalizeApiError(state.query.error).message}
            </p>
            <Button variant="outline" onClick={() => void state.query.refetch()}>
              {t("invoicePolicies.retry")}
            </Button>
          </div>
        ) : !state.query.data?.length ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("invoicePolicies.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("common.apiColumns.id")}</th>
                  <th className="px-4 py-3 font-medium">{t("invoicePolicies.fields.title")}</th>
                  <th className="px-4 py-3 font-medium">{t("invoicePolicies.fields.sortOrder")}</th>
                  <th className="px-4 py-3 font-medium">{t("invoicePolicies.fields.active")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.apiColumns.createdAt")}</th>
                  <th className="px-4 py-3 font-medium">{t("common.apiColumns.updatedAt")}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("common.actions.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.query.data.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{item.id}</td>
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{item.sortOrder}</td>
                    <td className="px-4 py-3">
                      {t(
                        item.active
                          ? "invoicePolicies.active"
                          : "invoicePolicies.inactive",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.createdAt
                        ? formatAuditDateTime(item.createdAt)
                        : t("common.empty.dash")}
                    </td>
                    <td className="px-4 py-3">
                      {item.updatedAt
                        ? formatAuditDateTime(item.updatedAt)
                        : t("common.empty.dash")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <PermissionGuard permission={PERMISSIONS.invoicePoliciesUpdate}>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy}
                            onClick={() => state.edit(item)}
                            aria-label={t("common.actions.edit")}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission={PERMISSIONS.invoicePoliciesDelete}>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={state.busy}
                            onClick={() => void state.remove(item)}
                            aria-label={t("common.actions.delete")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InvoicePolicyDialog state={state} />
    </div>
  );
}
