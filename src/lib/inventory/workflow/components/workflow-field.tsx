'use client';
import { useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { useEmployees } from '@/lib/employees/hooks/use-employees';
import { useTranslation } from '@/lib/i18n';
import { useVehiclePicker } from '@/lib/vehicles/hooks/use-vehicles';
import { useWorkflowAccess, useWorkflowErrorMessage, useWorkflowList } from '../hooks/use-workflow';
import { allResources } from '../resources';
import type { Field, Reference, WorkflowRecord } from '../types/workflow';
import { workflowFieldLabel, workflowOptionLabel } from './workflow-data';

type Lookup = { options: SearchableSelectOption[]; loading: boolean; error?: string; retry?: () => void; loadMore?: () => void };

/** Readable option label for any workflow record. */
export function workflowRecordLabel(row: WorkflowRecord, t: (key: string) => string): string {
  const named = row.displayName ?? row.name ?? row.companyName;
  if (named) return String(named);
  const parts = [row.businessDate, row.method ? workflowOptionLabel(t, String(row.method)) : undefined, row.status ? workflowOptionLabel(t, String(row.status)) : undefined]
    .filter(Boolean)
    .map(String);
  if (typeof row.amountMinor === 'number') parts.push(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.amountMinor / 100));
  return parts.length ? `${parts.join(' · ')} · ${row.id}` : row.id;
}

const LIST_REFERENCES: Partial<Record<Reference, { resource: string; keep: (row: WorkflowRecord) => boolean }>> = {
  holders: { resource: 'holders', keep: row => row.isActive !== false },
  warehouse: { resource: 'holders', keep: row => row.isActive !== false && row.type === 'WAREHOUSE' },
  custodian: { resource: 'holders', keep: row => row.isActive !== false && ['EMPLOYEE', 'VEHICLE', 'ROUTE_CREW'].includes(String(row.type)) },
  items: { resource: 'items', keep: row => row.isActive !== false },
  suppliers: { resource: 'suppliers', keep: row => row.isActive !== false },
  'route-crews': { resource: 'route-crews', keep: row => row.isActive !== false },
  'daily-routes': { resource: 'daily-routes', keep: () => true },
  closeouts: { resource: 'closeouts', keep: () => true },
  payments: { resource: 'payments', keep: row => row.status !== 'VOIDED' && row.status !== 'REJECTED' },
  'verified-payments': { resource: 'payments', keep: row => row.status === 'VERIFIED' },
  'received-handovers': { resource: 'cash-handovers', keep: row => row.status === 'RECEIVED' },
};

function useListLookup(resourceKey: string, keep: (row: WorkflowRecord) => boolean): Lookup {
  const { t } = useTranslation();
  const can = useWorkflowAccess();
  const toMessage = useWorkflowErrorMessage();
  const read = allResources.find(resource => resource.key === resourceKey)?.read ?? 'inventory.read';
  const query = useWorkflowList(resourceKey, {}, can(read));
  const options = useMemo(
    () => (query.data?.pages.flatMap(page => page.data) ?? []).filter(keep).map(row => ({
      value: row.id,
      label: workflowRecordLabel(row, t),
      description: row.type ? workflowOptionLabel(t, String(row.type)) : undefined,
      keywords: [String(row.sku ?? ''), String(row.entityId ?? '')],
    })),
    [keep, query.data?.pages, t],
  );
  return {
    options,
    loading: query.isPending && query.fetchStatus !== 'idle',
    error: query.isError ? toMessage(query.error) : undefined,
    retry: () => void query.refetch(),
    loadMore: query.hasNextPage && !query.isFetchingNextPage ? () => void query.fetchNextPage() : undefined,
  };
}

function useEmployeeLookup(): Lookup {
  const query = useEmployees({ page: 1, limit: 200, sort: 'name:asc' });
  const options = useMemo(
    () => (query.data?.items ?? []).filter(employee => employee.active).map(employee => ({ value: String(employee.id), label: employee.name })),
    [query.data?.items],
  );
  return { options, loading: query.isLoading };
}

function useVehicleLookup(): Lookup {
  const query = useVehiclePicker(200, { enabled: true });
  const options = useMemo(
    () => (query.data?.items ?? []).filter(vehicle => vehicle.active).map(vehicle => ({ value: vehicle.id, label: vehicle.name || vehicle.vehicleId || vehicle.id })),
    [query.data?.items],
  );
  return { options, loading: query.isLoading };
}

type SelectProps = { field: Field; path: string; lookup?: Lookup; options?: SearchableSelectOption[] };

function WorkflowSelect({ field, path, lookup, options }: SelectProps) {
  const { t } = useTranslation();
  const { control } = useFormContext();
  return (
    <>
      <Controller
        control={control}
        name={path}
        render={({ field: control, fieldState }) => (
          <SearchableSelect
            id={path}
            value={String(control.value ?? '')}
            onValueChange={control.onChange}
            onClose={control.onBlur}
            options={lookup?.options ?? options ?? []}
            loading={lookup?.loading}
            placeholder={t('inventory.operations.select')}
            searchPlaceholder={t('inventory.search.options')}
            emptyMessage={t('inventory.empty.noOptions')}
            loadingMessage={t('common.loading')}
            required={!field.optional}
            aria-invalid={Boolean(fieldState.error)}
            mobileSheet
          />
        )}
      />
      {lookup?.error ? <span role="alert" className="text-xs text-destructive">{lookup.error} <Button type="button" variant="link" className="h-auto p-0" onClick={lookup.retry}>{t('inventory.operations.retry')}</Button></span> : null}
      {lookup?.loadMore ? <Button type="button" variant="link" className="h-auto justify-start p-0 text-xs" onClick={lookup.loadMore}>{t('inventory.operations.loadMoreOptions')}</Button> : null}
    </>
  );
}

function ListReferenceSelect({ reference, ...props }: Omit<SelectProps, 'lookup'> & { reference: Reference }) {
  const config = LIST_REFERENCES[reference]!;
  const lookup = useListLookup(config.resource, config.keep);
  return <WorkflowSelect {...props} lookup={lookup} />;
}

function EmployeeSelect(props: Omit<SelectProps, 'lookup'>) {
  return <WorkflowSelect {...props} lookup={useEmployeeLookup()} />;
}

function VehicleSelect(props: Omit<SelectProps, 'lookup'>) {
  return <WorkflowSelect {...props} lookup={useVehicleLookup()} />;
}

function ReferenceSelect({ reference, field, path }: { reference: Reference; field: Field; path: string }) {
  const holderType = useWatch({ name: 'type' }) as string | undefined;
  const targetType = useWatch({ name: 'targetType' }) as string | undefined;
  if (reference === 'allocation-target') {
    if (targetType === 'SALES_REPORT') return <AllocationTargetSelect key={targetType} resource="sales-reports" field={field} path={path} />;
    if (targetType === 'COLLECTION_OBLIGATION') return <AllocationTargetSelect key={targetType} resource="collection-obligations" field={field} path={path} />;
    return <WorkflowSelect field={field} path={path} options={[]} />;
  }
  const resolved: Reference | undefined = reference !== 'holder-entity'
    ? reference
    : holderType === 'EMPLOYEE' ? 'employees' : holderType === 'VEHICLE' ? 'vehicles' : holderType === 'ROUTE_CREW' ? 'route-crews' : undefined;
  if (!resolved) return <WorkflowSelect field={field} path={path} options={[]} />;
  if (resolved === 'employees') return <EmployeeSelect key={resolved} field={field} path={path} />;
  if (resolved === 'vehicles') return <VehicleSelect key={resolved} field={field} path={path} />;
  return <ListReferenceSelect key={resolved} reference={resolved} field={field} path={path} />;
}

const keepAllocatable = (row: WorkflowRecord) => !['POSTED', 'CANCELLED', 'SETTLED', 'VOIDED'].includes(String(row.status));

function AllocationTargetSelect({ resource, field, path }: { resource: string; field: Field; path: string }) {
  const lookup = useListLookup(resource, keepAllocatable);
  return <WorkflowSelect field={field} path={path} lookup={lookup} />;
}

export function WorkflowField({ field, path = field.name }: { field: Field; path?: string }) {
  const { t } = useTranslation();
  const { register, getFieldState, formState } = useFormContext();
  const error = getFieldState(path, formState).error;
  const label = workflowFieldLabel(t, field.labelKey ?? field.name);
  const errorMessage = error?.message ? (error.message.startsWith('inventory.') ? t(error.message) : error.message) : undefined;

  return (
    <div className="grid min-w-0 gap-1 text-sm">
      <label htmlFor={path}>{label}{field.optional ? ` (${t('inventory.form.workflow.optional').toLowerCase()})` : ''}</label>
      {field.reference ? (
        <ReferenceSelect reference={field.reference} field={field} path={path} />
      ) : field.kind === 'select' ? (
        <WorkflowSelect field={field} path={path} options={(field.options ?? []).map(option => ({ value: option, label: workflowOptionLabel(t, option) }))} />
      ) : (
        <Input
          id={path}
          {...register(path)}
          type={field.kind === 'money' ? 'text' : field.kind ?? 'text'}
          inputMode={field.kind === 'money' ? 'decimal' : field.kind === 'number' ? 'numeric' : undefined}
          placeholder={field.kind === 'money' ? '0.00' : undefined}
          step={field.kind === 'number' ? 1 : undefined}
          min={field.min}
          aria-required={!field.optional}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${path}-error` : undefined}
          className="h-10"
        />
      )}
      {errorMessage ? <span id={`${path}-error`} className="text-destructive">{errorMessage}</span> : null}
    </div>
  );
}
