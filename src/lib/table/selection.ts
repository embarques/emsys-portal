/**
 * Invert selection on the current page: deselect checked rows on this page,
 * select every other row on this page. Selections from other pages are kept.
 */
export function selectAllOthers(pageRowIds: string[], selectedIds: string[]): string[] {
  const pageIdSet = new Set(pageRowIds);
  const selectedOnPage = new Set(selectedIds.filter((id) => pageIdSet.has(id)));
  const othersOnPage = pageRowIds.filter((id) => !selectedOnPage.has(id));
  const selectedOffPage = selectedIds.filter((id) => !pageIdSet.has(id));

  return [...selectedOffPage, ...othersOnPage];
}

export function canSelectAllOthers(pageRowIds: string[], selectedIds: string[]): boolean {
  if (pageRowIds.length <= 1) return false;

  const selected = new Set(selectedIds);
  const selectedOnPageCount = pageRowIds.filter((id) => selected.has(id)).length;
  const unselectedOnPageCount = pageRowIds.length - selectedOnPageCount;

  return selectedOnPageCount > 0 && unselectedOnPageCount > 0;
}
