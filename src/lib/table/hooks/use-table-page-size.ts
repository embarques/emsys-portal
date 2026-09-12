import { useRef, useState } from "react";

import {
  DEFAULT_TABLE_PAGE_SIZE,
  resolveTablePageLimit,
  type TablePageSize,
} from "@/lib/table/page-size";

export function useTablePageSize() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const knownTotalRef = useRef(0);

  function rememberTotal(total: number) {
    if (total > 0) knownTotalRef.current = total;
  }

  const pageLimit = resolveTablePageLimit(pageSize, knownTotalRef.current);

  function changePageSize(next: TablePageSize) {
    setPageSize(next);
    setPage(1);
  }

  return { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal };
}
