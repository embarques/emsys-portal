'use client';
import { useState } from 'react';
import { useFieldArray, useForm, useFormContext, FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';
import { areFormValuesEquivalent } from '@/lib/forms/are-form-values-equivalent';
import { useFeedback } from '@/components/app-shell/feedback-provider';
import type { Field, Resource, WorkflowRecord, Command } from '../types/workflow';
import { fieldsSchema, workflowSchema, toPayload } from '../schemas/workflow-schema';
import { useWorkflowAccess, useWorkflowList, useWorkflowWrite, useWorkflowDetail } from '../hooks/use-workflow';
import { workflowError } from '../api/workflow-api';
import { WorkflowData } from './workflow-data';

export function WorkflowField({ field, path = field.name }: { field: Field; path?: string }) {
  const { register, getFieldState, formState } = useFormContext();
  const error = getFieldState(path, formState).error;
  const can = useWorkflowAccess();
  const reference = field.reference;
  const resource = reference === 'warehouse' || reference === 'custodian' ? 'holders' : reference;
  const lookup = useWorkflowList(resource ?? 'holders', {}, Boolean(reference) && can('inventory.read'));
  const records = lookup.data?.pages.flatMap(page => page.data).filter(row => row.isActive !== false && (reference !== 'warehouse' || row.type === 'WAREHOUSE') && (reference !== 'custodian' || ['EMPLOYEE', 'VEHICLE', 'ROUTE_CREW'].includes(String(row.type)))) ?? [];
  return <label className="grid min-w-0 gap-1 text-sm"><span>{field.label}{field.optional ? ' (optional)' : ''}</span>
    {reference || field.kind === 'select' ? <select {...register(path)} className="h-10 w-full rounded-md border bg-background px-3" aria-required={!field.optional} aria-invalid={Boolean(error)} aria-describedby={error ? `${path}-error` : undefined}><option value="">Select…</option>{reference ? records.map(row => <option key={row.id} value={row.id}>{String(row.displayName ?? row.name ?? row.companyName ?? row.id)}{row.type ? ` · ${row.type}` : ''}</option>) : field.options?.map(option => <option key={option}>{option}</option>)}</select> : <Input {...register(path)} type={field.kind === 'money' ? 'text' : field.kind ?? 'text'} inputMode={field.kind === 'money' ? 'decimal' : undefined} step={field.kind === 'number' ? 1 : undefined} min={field.min} aria-required={!field.optional} aria-invalid={Boolean(error)} aria-describedby={error ? `${path}-error` : undefined} className="h-10" />}
    {error && <span id={`${path}-error`} className="text-destructive">{error.message}</span>}
    {lookup.isError && reference && <span role="alert">{workflowError(lookup.error)} <Button type="button" variant="link" onClick={() => lookup.refetch()}>Retry</Button></span>}
    {reference && lookup.hasNextPage && <Button type="button" variant="link" disabled={lookup.isFetchingNextPage} onClick={() => lookup.fetchNextPage()}>Load more options</Button>}
  </label>;
}
function PriceGroups({ index }: { index: number }) {
  const { control, watch } = useFormContext();
  const groups = useFieldArray({ control, name: `lines.${index}.priceBreakdowns` });
  if (watch(`lines.${index}.pricingMode`) !== 'PRICE_GROUPS') return null;
  return <div className="space-y-2 sm:col-span-2"><p className="text-sm">Actual price groups (must match quantity and revenue)</p>{groups.fields.map((group, groupIndex) => <div key={group.id} className="flex flex-wrap items-end gap-2"><WorkflowField field={{ name: 'quantity', label: 'Group quantity', kind: 'number', min: 1 }} path={`lines.${index}.priceBreakdowns.${groupIndex}.quantity`} /><WorkflowField field={{ name: 'unitPriceMinor', label: 'Unit price (USD)', kind: 'money' }} path={`lines.${index}.priceBreakdowns.${groupIndex}.unitPriceMinor`} /><Button variant="ghost" type="button" onClick={() => groups.remove(groupIndex)}>Remove group</Button></div>)}<Button variant="outline" type="button" onClick={() => groups.append({ quantity: '', unitPriceMinor: '' })}>Add price group</Button></div>;
}
function defaults(fields: Field[], entity?: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => {
    const value = entity?.[field.name];
    if (value === undefined || value === null) return [field.name, ''];
    if (field.kind === 'money') return [field.name, (Number(value) / 100).toFixed(2)];
    if (field.kind === 'datetime-local') {
      const instant = new Date(String(value));
      return [field.name, new Date(instant.getTime() - instant.getTimezoneOffset() * 60000).toISOString().slice(0, 16)];
    }
    return [field.name, String(value)];
  }));
}
export function WorkflowForm({ resource, entity, command, onDone }: { resource: Resource; entity?: WorkflowRecord; command?: Command; onDone: () => void }) {
  const fields = command ? command.fields ?? [] : resource.fields ?? [];
  const lineFields = command ? undefined : resource.lines;
  const sourceLines = resource.key === 'daily-routes' ? entity?.members : entity?.lines;
  const initial = { ...defaults(fields, command ? undefined : entity), ...(lineFields ? { lines: Array.isArray(sourceLines) ? sourceLines.map(line => ({ ...defaults(lineFields, line), ...(resource.key === 'supply-sales-reports' ? { priceBreakdowns: (line.priceBreakdowns ?? []).map((group: { quantity: number; unitPriceMinor: number }) => ({ quantity: String(group.quantity), unitPriceMinor: (group.unitPriceMinor / 100).toFixed(2) })) } : {}) })) : [defaults(lineFields)] } : {}) };
  const form = useForm<Record<string, unknown>>({ defaultValues: initial });
  const lines = useFieldArray({ control: form.control, name: 'lines' as never });
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const mutation = useWorkflowWrite();
  const { notifySuccess } = useFeedback();
  const { t } = useTranslation();
  const submit = form.handleSubmit(async values => {
    setError('');
    form.clearErrors();
    const parsed = (command ? fieldsSchema(fields) : workflowSchema(resource)).safeParse(values);
    if (!parsed.success) { parsed.error.issues.forEach(issue => form.setError(issue.path.join('.'), { message: issue.message })); setError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n')); return; }
    if (command && typeof parsed.data.amountMinor === 'number' && parsed.data.amountMinor <= 0) { setError('Amount must be greater than zero.'); return; }
    if (command?.action === 'settlements' && Boolean(parsed.data.paymentId) === Boolean(parsed.data.handoverId)) { setError('Choose exactly one verified payment or received handover.'); return; }
    if (entity && !command && areFormValuesEquivalent(values, initial)) { notifySuccess(t('common.form.noChanges')); onDone(); return; }
    if (!review) { setReview(true); return; }
    try {
      await mutation.mutateAsync({ resource: resource.key, id: entity?.id, action: command?.action, update: Boolean(entity && !command), version: entity?.version, data: command ? parsed.data : toPayload(resource, parsed.data, entity) });
      notifySuccess('Saved successfully'); onDone();
    } catch (failure) { setError(workflowError(failure)); }
  });
  return <FormProvider {...form}><form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">{command?.label ?? (entity ? 'Edit draft' : `Create ${resource.label.toLowerCase()}`)}</h3>
    {error && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{error}</p>}
    {review ? <><p>Review before confirming. Posted transactions cannot be edited.</p><WorkflowData value={form.getValues()} /><Button type="button" variant="outline" onClick={() => setReview(false)} disabled={mutation.isPending}>Back to edit</Button></> : <><div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <WorkflowField key={field.name} field={field} />)}</div>
    {lineFields && <StockAvailability resource={resource} />}
    {lineFields && <div className="space-y-3">{lines.fields.map((line, index) => <fieldset key={line.id} className="grid gap-3 rounded border p-3 sm:grid-cols-2"><legend>Item {index + 1}</legend>{lineFields.map(field => <WorkflowField key={field.name} field={field} path={`lines.${index}.${field.name}`} />)}{resource.key === 'supply-sales-reports' && <PriceGroups index={index} />}<Button type="button" variant="ghost" onClick={() => lines.remove(index)}>Remove item</Button></fieldset>)}<Button type="button" variant="outline" onClick={() => lines.append(defaults(lineFields) as never)}>Add item</Button></div>}</>}
    <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : review ? 'Confirm' : 'Review'}</Button><Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>Cancel</Button></div>
  </form></FormProvider>;
}

function StockAvailability({ resource }: { resource: Resource }) {
  const { watch } = useFormContext();
  const holderId = watch('fromHolderId') || watch('holderId');
  const can = useWorkflowAccess();
  const enabled = ['dispatches', 'returns', 'dispositions', 'supply-sales-reports'].includes(resource.key);
  const stock = useWorkflowDetail('holders', holderId, 'stock', enabled && can('inventory.read'));
  if (!holderId || !enabled) return null;
  return <details className="rounded border p-3" open><summary className="text-sm font-medium">Current holder stock</summary>{stock.isPending ? <p role="status">Loading stock…</p> : stock.isError ? <p role="alert">{workflowError(stock.error)}</p> : <WorkflowData value={stock.data?.data} />}</details>;
}
