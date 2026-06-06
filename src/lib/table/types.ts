export type ColumnVisibilityDefinition = {
  id: string;
  label: string;
  hideable?: boolean;
};

export type DataTableColumn<T> = ColumnVisibilityDefinition & {
  headerClassName?: string;
  cellClassName?: string;
  stopRowClick?: boolean;
  renderCell: (row: T) => React.ReactNode;
};
