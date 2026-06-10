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
  stopRowClick?: boolean;
  renderCell: (row: T) => React.ReactNode;
};
