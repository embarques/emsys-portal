'use client';
import { useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { areFormValuesEquivalent } from '@/lib/forms/are-form-values-equivalent';
import { useFeedback } from '@/components/app-shell/feedback-provider';
import { useTranslation } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowWrite } from '../hooks/use-workflow';
import { workflowError } from '../api/workflow-api';
import { closeoutSchema, validateCloseout, type CloseoutPreview } from '../utils/closeout';
import type { WorkflowRecord } from '../types/workflow';
import { WorkflowData } from './workflow-data';
import { WorkflowField } from './workflow-form';

export function CloseoutPanel({ entity }: { entity: WorkflowRecord }) {
  const preview = useWorkflowDetail('closeouts', entity.id, 'preview', entity.status !== 'CLOSED');
  const revisions = useWorkflowDetail('closeouts', entity.id, 'revisions');
  return <div className="space-y-4">
    {entity.status !== 'CLOSED' && <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Reconciliation preview</h3><p className="text-sm text-muted-foreground">Post sales, returns and classified losses before closing. Retained stock stays with this holder.</p><Button variant="outline" onClick={() => preview.refetch()} disabled={preview.isFetching}>Refresh preview</Button>{preview.isError && <p role="alert">{workflowError(preview.error)}</p>}{preview.isPending && <p role="status">Loading preview…</p>}{preview.data && <><WorkflowData value={preview.data.data} /><CountForm entity={entity} initial={preview.data.data} refresh={async () => { const result = await preview.refetch(); if (result.error) throw result.error; if (!result.data) throw new Error('Preview unavailable.'); return { ...result.data.data, version: result.data.version ?? result.data.data.version } as unknown as CloseoutPreview; }} /></>}</section>}
    <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Immutable revisions</h3>{revisions.isPending ? <p role="status">Loading history…</p> : revisions.isError ? <p role="alert">{workflowError(revisions.error)} <Button variant="link" onClick={() => revisions.refetch()}>Retry</Button></p> : <WorkflowData value={revisions.data?.data} />}</section>
  </div>;
}
function CountForm({ entity, initial, refresh }: { entity: WorkflowRecord; initial: WorkflowRecord; refresh: () => Promise<CloseoutPreview> }) {
  const inventoryLines = Array.isArray(initial.inventoryLines) ? initial.inventoryLines as Record<string, unknown>[] : [];
  const form = useForm({ defaultValues: { countedItems: inventoryLines.map(line => ({ itemId: String(line.itemId), available: line.countedAvailableEnding === undefined ? '' : String(line.countedAvailableEnding), quarantined: line.countedQuarantinedEnding === undefined ? '' : String(line.countedQuarantinedEnding) })), financialDifferenceReason: String(entity.financialDifferenceReason ?? ''), notes: String(entity.notes ?? '') } });
  const counts = useFieldArray({ control: form.control, name: 'countedItems' });
  const can = useWorkflowAccess();
  const mutation = useWorkflowWrite();
  const { notifySuccess } = useFeedback();
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState<string>();
  const submit = form.handleSubmit(async raw => {
    setError('');
    if (!can('closeout.finalize')) return;
    if (raw.countedItems.some(line => line.available.trim() === '' || line.quarantined.trim() === '')) { setError('Enter both available and quarantined counts for every item, including zero.'); return; }
    const parsed = closeoutSchema.safeParse(raw);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join('\n')); return; }
    try {
      const current = await refresh();
      const problem = validateCloseout(parsed.data, current);
      if (problem) { setError(problem); setReviewed(undefined); return; }
      const signature = JSON.stringify([parsed.data, current]);
      if (reviewed !== signature) { setReviewed(signature); return; }
      await mutation.mutateAsync({ resource: 'closeouts', id: entity.id, action: 'close', version: current.version, data: parsed.data });
      setReviewed(undefined);
    } catch (failure) { setError(workflowError(failure)); }
  });
  const saveDraft = form.handleSubmit(async raw => {
    setError('');
    if (areFormValuesEquivalent(raw, form.formState.defaultValues)) { notifySuccess(t('common.form.noChanges')); return; }
    const parsed = closeoutSchema.safeParse({ ...raw, countedItems: raw.countedItems.filter(line => line.available !== '' || line.quarantined !== '') });
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join('\n')); return; }
    try {
      await mutation.mutateAsync({ resource: 'closeouts', id: entity.id, update: true, version: entity.version, data: parsed.data });
      form.reset(raw); notifySuccess('Closeout progress saved');
    } catch (failure) { setError(workflowError(failure)); }
  });
  if (!can('closeout.finalize') && !can('closeout.record')) return <p className="text-sm text-muted-foreground">Read-only reconciliation. Finalizing requires closeout permission.</p>;
  return <FormProvider {...form}><form onSubmit={submit} className="space-y-4 border-t pt-4"><h4 className="font-medium">Physical count</h4>{error && <p role="alert" className="text-destructive">{error}</p>}
    {counts.fields.map((line, index) => <fieldset key={line.id} className="grid gap-3 rounded border p-3 sm:grid-cols-3"><legend>Count {index + 1}</legend><WorkflowField field={{ name: 'itemId', label: 'Item', reference: 'items' }} path={`countedItems.${index}.itemId`} /><label className="grid gap-1 text-sm">Available<Input type="number" min={0} step={1} {...form.register(`countedItems.${index}.available`)} /></label><label className="grid gap-1 text-sm">Quarantined<Input type="number" min={0} step={1} {...form.register(`countedItems.${index}.quarantined`)} /></label></fieldset>)}
    <Button type="button" variant="outline" onClick={() => counts.append({ itemId: '', available: '', quarantined: '' })}>Add unexpectedly found item</Button>
    <label className="grid gap-1 text-sm">Financial difference explanation<textarea {...form.register('financialDifferenceReason')} className="min-h-20 rounded border bg-background p-2" /></label><label className="grid gap-1 text-sm">Notes<textarea {...form.register('notes')} className="min-h-20 rounded border bg-background p-2" /></label>
    {reviewed && <p role="status">Counts reconcile with the preview. Confirm to create an immutable revision. Sales and returns will not be posted again.</p>}{can('closeout.record') && <Button type="button" variant="outline" disabled={mutation.isPending || form.formState.isSubmitting} onClick={saveDraft}>Save progress</Button>} {can('closeout.finalize') && <Button type="submit" disabled={mutation.isPending || form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Checking…' : reviewed ? 'Confirm closeout' : 'Review & close'}</Button>}
  </form></FormProvider>;
}
