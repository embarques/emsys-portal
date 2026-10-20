'use client';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { allResources } from '../resources';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowErrorMessage, useWorkflowList, useWorkflowScope } from '../hooks/use-workflow';
import type { Command, Resource, WorkflowRecord } from '../types/workflow';
import { normalizeRecord } from '../api/workflow-api';
import { WorkflowForm, type WorkflowFormTarget } from './workflow-form';
import { WorkflowData, workflowOptionLabel } from './workflow-data';
import { WorkflowField, workflowRecordLabel } from './workflow-field';
import { WorkflowChildren } from './workflow-children';
import { CloseoutPanel } from './closeout-panel';

/** Navigation groups follow the supply lifecycle: setup → stock → sales & money → closeout → reports. */
const RESOURCE_GROUPS: { key: string; resources: string[] }[] = [
  { key: 'setup', resources: ['holders', 'items', 'suppliers', 'route-crews', 'daily-routes'] },
  { key: 'stock', resources: ['stock', 'receipts', 'dispatches', 'returns', 'dispositions', 'counts', 'adjustments'] },
  { key: 'money', resources: ['sales-reports', 'payments', 'cash-handovers', 'collection-obligations'] },
  { key: 'closeout', resources: ['closeouts'] },
  { key: 'reports', resources: ['reports/stock-valuation', 'reports/sales', 'reports/obligations', 'reports/discrepancies', 'audit-events', 'journal-entries'] },
];

export function InventoryWorkflowWorkspace() {
  const { t } = useTranslation();
  const company = useWorkflowScope();
  if (process.env.NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED !== 'true') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">{t('inventory.operations.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('inventory.operations.disabled')}</p>
      </div>
    );
  }
  return <WorkflowWorkspace key={company} />;
}

function WorkflowWorkspace() {
  const { t } = useTranslation();
  const can = useWorkflowAccess();
  const available = allResources.filter(resource => can(resource.read));
  const [selected, setSelected] = useState('holders');
  const resource = available.find(entry => entry.key === selected) ?? available[0];
  return (
    <div className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('inventory.operations.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('inventory.operations.subtitle')}</p>
      </header>
      {!resource ? (
        <p role="status">{t('inventory.operations.noAccess')}</p>
      ) : (
        <>
          <nav aria-label={t('inventory.operations.navLabel')} className="space-y-3">
            {RESOURCE_GROUPS.map(group => {
              const entries = available.filter(entry => group.resources.includes(entry.key));
              if (!entries.length) return null;
              return (
                <div key={group.key} className="flex flex-wrap items-center gap-2">
                  <span className="w-full text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-36">{t(`inventory.operations.groups.${group.key}`)}</span>
                  {entries.map(entry => (
                    <Button key={entry.key} size="sm" variant={entry.key === resource.key ? 'default' : 'outline'} onClick={() => setSelected(entry.key)}>
                      {t(`inventory.operations.resources.${entry.key}.label`)}
                    </Button>
                  ))}
                </div>
              );
            })}
          </nav>
          <ResourceWorkspace key={resource.key} resource={resource} />
        </>
      )}
    </div>
  );
}

function ResourceWorkspace({ resource }: { resource: Resource }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const can = useWorkflowAccess();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filterFields = resource.filters ?? [];
  const filterForm = useForm<Record<string, string>>({ defaultValues: Object.fromEntries(filterFields.map(field => [field.name, ''])) });
  const [id, setId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const list = useWorkflowList(resource.key, filters, can(resource.read));
  const rows = list.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t(`inventory.operations.resources.${resource.key}.label`)}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{t(`inventory.operations.resources.${resource.key}.description`)}</p>
        </div>
        {resource.create && can(resource.create) ? (
          <Button onClick={() => { setCreating(true); setId(undefined); }}>{t('inventory.operations.create')}</Button>
        ) : null}
      </div>
      {filterFields.length ? (
        <FormProvider {...filterForm}>
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
            onSubmit={filterForm.handleSubmit(values => {
              setFilters(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')));
              setId(undefined);
            })}
          >
            {filterFields.map(field => <div key={field.name} className="min-w-48"><WorkflowField field={{ ...field, optional: true }} /></div>)}
            <Button variant="outline" type="submit">{t('inventory.operations.filter')}</Button>
            <Button variant="ghost" type="button" onClick={() => { filterForm.reset(); setFilters({}); }}>{t('inventory.operations.clear')}</Button>
          </form>
        </FormProvider>
      ) : null}
      {creating ? <WorkflowForm target={{ mode: 'create', resource }} onDone={() => setCreating(false)} /> : null}
      {list.isPending ? <p role="status">{t('common.loading')}</p> : null}
      {list.isError ? (
        <div role="alert" className="rounded border border-destructive p-4">
          <p>{toMessage(list.error)}</p>
          <Button variant="outline" onClick={() => list.refetch()}>{t('inventory.operations.retry')}</Button>
        </div>
      ) : null}
      {!list.isPending && !list.isError && !rows.length ? <p className="rounded border p-6 text-muted-foreground">{t('inventory.operations.empty')}</p> : null}
      <div className="grid gap-2">
        {rows.map((row, index) => (
          <WorkflowRow
            key={row.id ?? index}
            resource={resource}
            row={row}
            active={row.id === id}
            onOpen={() => { setCreating(false); setId(row.id); }}
          />
        ))}
      </div>
      {list.hasNextPage ? (
        <Button variant="outline" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{t('inventory.operations.loadMore')}</Button>
      ) : null}
      {id && !resource.readOnly ? <Detail key={id} resource={resource} id={id} onClose={() => setId(undefined)} /> : null}
    </section>
  );
}

function WorkflowRow({ resource, row, active, onOpen }: { resource: Resource; row: WorkflowRecord; active: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const secondary = [row.businessDate, row.type ? workflowOptionLabel(t, String(row.type)) : undefined].filter(Boolean).join(' · ');
  const header = (
    <span className="flex w-full flex-wrap items-center justify-between gap-2">
      <span className="font-medium">{row.id ? workflowRecordLabel(row, t) : t('inventory.operations.row')}</span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {secondary}
        {row.status ? <Badge variant="outline">{workflowOptionLabel(t, String(row.status))}</Badge> : null}
      </span>
    </span>
  );
  if (resource.readOnly || !row.id) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {resource.readOnly && row.id ? header : null}
        <WorkflowData value={row} />
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      className="rounded-lg border bg-card p-4 text-left hover:bg-muted focus-visible:ring-2 aria-pressed:border-primary"
      onClick={onOpen}
    >
      {header}
    </button>
  );
}

function Detail({ resource, id, onClose }: { resource: Resource; id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const query = useWorkflowDetail(resource.key, id);
  const can = useWorkflowAccess();
  const [target, setTarget] = useState<WorkflowFormTarget>();
  if (query.isPending) return <p role="status">{t('common.loading')}</p>;
  if (query.isError) return <p role="alert">{toMessage(query.error)} <Button variant="link" onClick={() => query.refetch()}>{t('inventory.operations.retry')}</Button></p>;
  const entity = normalizeRecord(query.data);
  const editable = Boolean(resource.edit && can(resource.edit) && (!resource.editStates || resource.editStates.includes(String(entity.status))));
  const commands = (resource.commands ?? []).filter((command: Command) => can(command.permission) && (!command.states || command.states.includes(String(entity.status))));
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold">{t(`inventory.operations.resources.${resource.key}.label`)} · {workflowRecordLabel(entity, t)}</h3>
        <Button variant="ghost" onClick={onClose}>{t('inventory.operations.closeDetail')}</Button>
        {editable ? <Button variant="outline" onClick={() => setTarget({ mode: 'edit', resource, entity })}>{t('common.actions.edit')}</Button> : null}
        {commands.map(command => (
          <Button key={command.action} variant="outline" onClick={() => setTarget({ mode: 'command', resource, entity, command })}>
            {t(`inventory.operations.commands.${command.action}`)}
          </Button>
        ))}
      </div>
      {target ? <WorkflowForm key={target.mode === 'command' ? target.command.action : target.mode} target={target} onDone={() => setTarget(undefined)} /> : null}
      <WorkflowData value={entity} />
      <WorkflowChildren resource={resource} entity={entity} />
      {resource.key === 'closeouts' ? <CloseoutPanel key={`${entity.id}:${entity.status}:${entity.version}`} entity={entity} /> : null}
    </section>
  );
}
