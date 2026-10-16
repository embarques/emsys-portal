'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { allResources, resources } from '../resources';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowList, useWorkflowScope } from '../hooks/use-workflow';
import type { Command, Resource, WorkflowRecord } from '../types/workflow';
import { normalizeRecord, workflowError } from '../api/workflow-api';
import { WorkflowForm } from './workflow-form';
import { WorkflowData } from './workflow-data';
import { CloseoutPanel } from './closeout-panel';

export function InventoryWorkflowWorkspace() {
  const company = useWorkflowScope();
  if (process.env.NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED !== 'true') return <div className="p-6"><h1 className="text-2xl font-semibold">Supply operations</h1><p className="mt-2 text-muted-foreground">Supply operations is not available for this deployment.</p></div>;
  return <WorkflowWorkspace key={company} />;
}
function WorkflowWorkspace() {
  const can = useWorkflowAccess();
  const available = allResources.filter(resource => can(resource.read));
  const [selected, setSelected] = useState('holders');
  const resource = available.find(entry => entry.key === selected) ?? available[0];
  return <div className="space-y-5 p-4 md:p-6"><header><h1 className="text-2xl font-semibold">Supply operations</h1><p className="mt-1 text-sm text-muted-foreground">Warehouse → accountable holder → sales, returns & daily closeout</p></header>
    {!resource ? <p role="status">Your account has no access to the supply workflow.</p> : <><nav aria-label="Supply workspaces" className="flex flex-wrap gap-2">{available.map(entry => <Button key={entry.key} variant={entry.key === resource.key ? 'default' : 'outline'} onClick={() => setSelected(entry.key)}>{entry.label}</Button>)}</nav><ResourceWorkspace key={resource.key} resource={resource} /></>}
  </div>;
}
function ResourceWorkspace({ resource }: { resource: Resource }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filterForm = useForm({ defaultValues: { holderId: '', businessDate: '', status: '', employeeId: '', itemId: '' } });
  const [id, setId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const can = useWorkflowAccess();
  const list = useWorkflowList(resource.key, filters, can(resource.read));
  const rows = list.data?.pages.flatMap(page => page.data) ?? [];
  const readOnlyReport = resource.key.startsWith('reports/') || ['audit-events', 'journal-entries'].includes(resource.key);
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{resource.label}</h2><p className="max-w-3xl text-sm text-muted-foreground">{resource.description}</p></div>{resource.create && can(resource.create) && <Button onClick={() => { setCreating(true); setId(undefined); }}>Create</Button>}</div>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border p-3" onSubmit={filterForm.handleSubmit(values => { setFilters(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))); setId(undefined); })}>{(['holderId', 'businessDate', 'status', 'employeeId', 'itemId'] as const).map(name => <label key={name} className="grid gap-1 text-xs">{{ holderId: 'Holder ID', businessDate: 'Business date', status: 'Status', employeeId: 'Employee ID', itemId: 'Item ID' }[name]}<Input type={name === 'businessDate' ? 'date' : 'text'} {...filterForm.register(name)} /></label>)}<Button variant="outline" type="submit">Filter</Button><Button variant="ghost" type="button" onClick={() => { filterForm.reset(); setFilters({}); }}>Clear</Button></form>
    {creating && <WorkflowForm resource={resource} onDone={() => setCreating(false)} />}
    {list.isPending && <p role="status">Loading…</p>}{list.isError && <div role="alert" className="rounded border border-destructive p-4"><p>{workflowError(list.error)}</p><Button variant="outline" onClick={() => list.refetch()}>Retry</Button></div>}
    {!list.isPending && !list.isError && !rows.length && <p className="rounded border p-6 text-muted-foreground">No records match these filters.</p>}
    <div className="grid gap-2">{rows.map((row, index) => <button key={row.id ?? index} type="button" className="flex flex-wrap justify-between gap-2 rounded-lg border bg-card p-4 text-left hover:bg-muted focus-visible:ring-2" onClick={() => { setCreating(false); if (!readOnlyReport) setId(row.id); }}><span className="font-medium">{String(row.displayName ?? row.name ?? row.companyName ?? row.id ?? `Row ${index + 1}`)}</span><span className="text-sm text-muted-foreground">{String(row.businessDate ?? row.type ?? '')} {row.status}</span>{(!row.id || readOnlyReport) && <WorkflowData value={row} />}</button>)}</div>
    {list.hasNextPage && <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button>}
    {id && <Detail key={id} resource={resource} id={id} onClose={() => setId(undefined)} />}
  </section>;
}
function Detail({ resource, id, onClose }: { resource: Resource; id: string; onClose: () => void }) {
  const query = useWorkflowDetail(resource.key, id);
  const can = useWorkflowAccess();
  const [action, setAction] = useState<Command | 'edit'>();
  if (query.isPending) return <p role="status">Loading detail…</p>;
  if (query.isError) return <p role="alert">{workflowError(query.error)} <Button variant="link" onClick={() => query.refetch()}>Retry</Button></p>;
  const entity = normalizeRecord(query.data);
  const editable = resource.edit && can(resource.edit) && (entity.status === 'DRAFT' || ['items', 'suppliers', 'route-crews', 'daily-routes'].includes(resource.key));
  const allocation: Command = { action: '', label: 'Allocate to obligation', permission: 'payments.allocate', fields: [{ name: 'targetId', label: 'Obligation ID' }, { name: 'amountMinor', label: 'Amount (USD)', kind: 'money' }] };
  return <section className="space-y-4 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">{resource.label} · {id}</h3><Button variant="ghost" onClick={onClose}>Close detail</Button>{editable && <Button variant="outline" onClick={() => setAction('edit')}>Edit</Button>}{resource.commands?.filter(command => can(command.permission) && (!command.states || command.states.includes(String(entity.status)))).map(command => <Button key={command.action} variant="outline" onClick={() => setAction(command)}>{command.label}</Button>)}{resource.key === 'payments' && entity.status !== 'VOIDED' && can('payments.allocate') && <Button variant="outline" onClick={() => setAction(allocation)}>Allocate</Button>}</div>
    {action && (action !== 'edit' && action.label === allocation.label ? null : <WorkflowForm key={action === 'edit' ? 'edit' : action.action} resource={resource} entity={entity} command={action === 'edit' ? undefined : action} onDone={() => setAction(undefined)} />)}
    {action !== 'edit' && action?.label === allocation.label && <WorkflowForm resource={{ key: 'payment-allocations', label: 'Allocation', read: 'payments.read', description: '', fields: [{ name: 'paymentId', label: 'Payment ID' }, { name: 'targetType', label: 'Target type', kind: 'select', options: ['SUPPLY_COLLECTION_OBLIGATION'] }, ...allocation.fields!] }} onDone={() => setAction(undefined)} />}
    <WorkflowData value={entity} />
    {resource.key === 'holders' && <HolderDetails entity={entity} />}
    {resource.key === 'closeouts' && <CloseoutPanel key={`${entity.id}:${entity.status}:${entity.version}`} entity={entity} />}
  </section>;
}
function HolderDetails({ entity }: { entity: WorkflowRecord }) {
  const stock = useWorkflowDetail('holders', entity.id, 'stock');
  const movements = useWorkflowDetail('holders', entity.id, 'movements');
  const can = useWorkflowAccess();
  const [reassign, setReassign] = useState(false);
  return <div className="space-y-4"><h4 className="font-semibold">Stock by condition</h4>{stock.isError ? <p role="alert">{workflowError(stock.error)}</p> : <WorkflowData value={stock.data?.data} />}<h4 className="font-semibold">Movement history</h4>{movements.isError ? <p role="alert">{workflowError(movements.error)}</p> : <WorkflowData value={movements.data?.data} />}{can('inventory.reassign') && <Button variant="outline" onClick={() => setReassign(!reassign)}>Administrative stock reassignment</Button>}{reassign && <WorkflowForm resource={{ key: 'holders/reassign-stock', label: 'Administrative reassignment', read: 'inventory.read', description: '', fields: [{ name: 'fromHolderId', label: 'Source holder', reference: 'holders' }, { name: 'toHolderId', label: 'Destination holder', reference: 'holders' }, { name: 'reason', label: 'Audited reason' }], lines: resources.find(resource => resource.key === 'returns')!.lines }} onDone={() => setReassign(false)} />}</div>;
}
