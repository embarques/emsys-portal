export type ColumnVisibilityDefinition = {
  id: string;
  label: string;
  hideable?: boolean;
  /** When false, column starts hidden until toggled in the Columns menu. Defaults to true. */
  defaultVisible?: boolean;
  /** Preferred width (px) when no saved column width exists. Defaults to 160. */
  defaultWidth?: number;
};

export type DataTableColumn<T> = ColumnVisibilityDefinition & {
  headerClassName?: string;
  cellClassName?: string;
  /**
   * When true, cell content is ellipsis-truncated to a single line.
   * Default is false: content wraps on whole words and columns auto-fit to show values.
   */
  truncateCell?: boolean;
  stopRowClick?: boolean;
  /**
   * When false, the cell is not wrapped for text selection helpers.
   * Defaults to true for plain text cells. Highlight-to-copy still works via native selection;
   * row click is suppressed while text is selected.
   */
  copyable?: boolean;
  /** Preferred plain text for the cell when content is custom-rendered. */
  copyValue?: (row: T) => string | undefined;
  /** When false, the column header is not clickable for sorting. Defaults to true. */
  sortable?: boolean;
  /** API sort field for this column (e.g. `phones.number`). Defaults to the column `id`. */
  sortField?: string;
  /** When false, table auto-fit will not resize this column to content width. Defaults to true. */
  autoFitColumn?: boolean;
  renderCell: (row: T) => React.ReactNode;
};
