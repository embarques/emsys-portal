export type ColumnVisibilityDefinition = {
  id: string;
  label: string;
  hideable?: boolean;
  /** When false, column starts hidden until toggled in the Columns menu. Defaults to true. */
  defaultVisible?: boolean;
};

export type DataTableColumn<T> = ColumnVisibilityDefinition & {
  headerClassName?: string;
  cellClassName?: string;
  /** When false, cell content is not wrapped in a truncating div (use for badges/pills). */
  truncateCell?: boolean;
  stopRowClick?: boolean;
  renderCell: (row: T) => React.ReactNode;
};
