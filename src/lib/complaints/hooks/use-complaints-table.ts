"use client";

import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { fetchComplaintsPage } from "@/lib/complaints/api/complaints-api";
import {
  complaintCategoryLabel,
  complaintSeverityLabel,
  complaintStatusLabel,
} from "@/lib/complaints/display";
import { COMPLAINT_TABLE_FILTER_FIELDS } from "@/lib/complaints/filter-fields";
import { useComplaintAccess, useComplaintsQueryEnabled } from "@/lib/complaints/hooks/use-complaints";
import type { Complaint, ComplaintCategory } from "@/lib/complaints/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useCatalogTable } from "@/lib/table/hooks/use-catalog-table";
import type { TableFilterFieldOption } from "@/lib/table/filter-builder";

export type ComplaintTableScope = "unresolved" | "all";

const complaintRowId = (complaint: Complaint) => complaint.id;

export function useComplaintsTable(categories: readonly ComplaintCategory[]) {
  const { companyId } = useAuth();
  const ready = useComplaintsQueryEnabled();
  const { canView } = useComplaintAccess();
  const [scope, setScopeState] = useState<ComplaintTableScope>("unresolved");

  const localizeOption = useCallback(
    (field: string, option: TableFilterFieldOption, t: (key: string) => string): TableFilterFieldOption => {
      if (field === "status") return { ...option, label: complaintStatusLabel(t, option.value) };
      if (field === "severity") return { ...option, label: complaintSeverityLabel(t, option.value) };
      if (field === "category") return { ...option, label: complaintCategoryLabel(t, option.value, categories) };
      return option;
    },
    [categories],
  );

  const table = useCatalogTable({
    fields: COMPLAINT_TABLE_FILTER_FIELDS,
    keyPrefix: "complaints.filters.fields",
    defaultSort: "createdAt:desc",
    getRowId: complaintRowId,
    enabled: ready && canView,
    queryKey: (params) => queryKeys.complaints.page(companyId, scope, params),
    fetchPage: (params, signal) => fetchComplaintsPage(params, { unresolvedOnly: scope === "unresolved", signal }),
    localizeOption,
  });

  return {
    table,
    scope,
    setScope: (next: ComplaintTableScope) => {
      setScopeState(next);
      table.pagination.setPage(1);
    },
    rowId: complaintRowId,
  };
}
