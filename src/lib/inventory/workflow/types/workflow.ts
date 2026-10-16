export type WorkflowRecord = { id: string; version?: number; status?: string; [key: string]: unknown };
export type Holder = WorkflowRecord & { type: 'WAREHOUSE' | 'EMPLOYEE' | 'VEHICLE' | 'ROUTE_CREW'; displayName: string; isActive: boolean };
export type Field = { name: string; label: string; kind?: 'number' | 'money' | 'date' | 'datetime-local' | 'select' | 'text'; options?: readonly string[]; reference?: 'holders' | 'warehouse' | 'custodian' | 'items' | 'suppliers'; optional?: boolean; min?: number };
export type Command = { action: string; label: string; permission: string; states?: string[]; fields?: Field[] };
export type Resource = { key: string; label: string; read: string; create?: string; fields?: Field[]; lines?: Field[]; commands?: Command[]; edit?: string; description: string };
export type Page = { data: WorkflowRecord[]; nextCursor: string | null };
export type Envelope = { data: WorkflowRecord; version?: number; postedMovements?: WorkflowRecord[] };
