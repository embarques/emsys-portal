export type WorkflowRecord = { id: string; version?: number; status?: string; [key: string]: unknown };
export type Holder = WorkflowRecord & { type: 'WAREHOUSE' | 'EMPLOYEE' | 'VEHICLE' | 'ROUTE_CREW'; displayName: string; isActive: boolean };

/**
 * Lookup sources for reference fields. `holder-entity` follows the selected holder
 * type and `allocation-target` follows the selected allocation target type.
 */
export type Reference =
  | 'holders'
  | 'warehouse'
  | 'custodian'
  | 'holder-entity'
  | 'items'
  | 'suppliers'
  | 'employees'
  | 'vehicles'
  | 'route-crews'
  | 'daily-routes'
  | 'closeouts'
  | 'payments'
  | 'verified-payments'
  | 'received-handovers'
  | 'allocation-target';

/** Labels resolve from `inventory.operations.fields.<labelKey ?? name>`. */
export type Field = {
  name: string;
  labelKey?: string;
  kind?: 'number' | 'money' | 'date' | 'datetime-local' | 'select' | 'text';
  options?: readonly string[];
  reference?: Reference;
  optional?: boolean;
  min?: number;
};

/**
 * `path` is the sub-path after `/{id}/` (defaults to `action`). `versioned` commands
 * send `If-Match`; `body: 'entity-lines'` resubmits the record's own lines.
 */
export type Command = {
  action: string;
  permission: string;
  path?: string;
  states?: string[];
  fields?: Field[];
  lines?: Field[];
  fixed?: Record<string, unknown>;
  versioned?: boolean;
  body?: 'fields' | 'entity-lines' | 'none';
};

/** Read-only sub-collection shown in a record's detail (`GET {resource}/{id}/{path}`). */
export type ChildList = { path: string; read?: string };

export type Resource = {
  key: string;
  read: string;
  create?: string;
  edit?: string;
  /** PATCH for inventory documents/catalog; PUT for route crews and daily routes. */
  editMethod?: 'patch' | 'put';
  /** Only records in these statuses can be edited (drafts). */
  editStates?: string[];
  fields?: Field[];
  lines?: Field[];
  /** Body key for `lines` (daily routes use `members`). */
  linesKey?: string;
  commands?: Command[];
  filters?: Field[];
  children?: ChildList[];
  readOnly?: boolean;
};

/** `responses.Success` list envelope (page-based pagination). */
export type Page = { data: WorkflowRecord[]; page: number; resultsPerPage?: number; total?: number };
export type Envelope = { data: WorkflowRecord; version?: number; postedMovements?: WorkflowRecord[] };
