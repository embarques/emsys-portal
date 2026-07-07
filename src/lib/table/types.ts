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
  /** When false, cell content is not wrapped in a truncating div (use for badges/pills). */
  truncateCell?: boolean;
  stopRowClick?: boolean;
  /** When false, the column header is not clickable for sorting. Defaults to true. */
  sortable?: boolean;
  /** API sort field for this column (e.g. `phones.number`). Defaults to the column `id`. */
  sortField?: string;
  /** When false, table auto-fit will not resize this column to content width. Defaults to true. */
  autoFitColumn?: boolean;
  renderCell: (row: T) => React.ReactNode;
};
