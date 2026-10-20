'use client';
import { useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/lib/i18n';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowErrorMessage, useWorkflowWrite } from '../hooks/use-workflow';
import { closeoutSchema, validateCloseout, type CloseoutPreview } from '../utils/closeout';
import type { WorkflowRecord } from '../types/workflow';
import { WorkflowData } from './workflow-data';
import { WorkflowField } from './workflow-field';

const OPEN_STATES = ['OPEN', 'REOPENED'];

export function CloseoutPanel({ entity }: { entity: WorkflowRecord }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const isOpen = OPEN_STATES.includes(String(entity.status));
  const preview = useWorkflowDetail('closeouts', entity.id, 'preview', isOpen);
  const revisions = useWorkflowDetail('closeouts', entity.id, 'revisions');
  return (
    <div className="space-y-4">
      {isOpen ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">{t('inventory.operations.closeout.previewTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('inventory.operations.closeout.previewHint')}</p>
          <Button variant="outline" onClick={() => preview.refetch()} disabled={preview.isFetching}>{t('inventory.operations.closeout.refreshPreview')}</Button>
          {preview.isError ? <p role="alert">{toMessage(preview.error)}</p> : null}
          {preview.isPending ? <p role="status">{t('common.loading')}</p> : null}
          {preview.data ? (
            <>
              <WorkflowData value={preview.data.data} />
              <CountForm
                entity={entity}
                initial={preview.data.data}
                refresh={async () => {
                  const result = await preview.refetch();
                  if (result.error) throw result.error;
                  if (!result.data) throw new Error('inventory.operations.closeout.previewIncomplete');
                  return { ...result.data.data, version: result.data.version ?? result.data.data.version } as unknown as CloseoutPreview;
                }}
              />
            </>
          ) : null}
        </section>
      ) : null}
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">{t('inventory.operations.closeout.revisionsTitle')}</h3>
        {revisions.isPending ? <p role="status">{t('common.loading')}</p> : revisions.isError ? (
          <p role="alert">{toMessage(revisions.error)} <Button variant="link" onClick={() => revisions.refetch()}>{t('inventory.operations.retry')}</Button></p>
        ) : <WorkflowData value={revisions.data?.data} />}
      </section>
    </div>
  );
}

function CountForm({ entity, initial, refresh }: { entity: WorkflowRecord; initial: WorkflowRecord; refresh: () => Promise<CloseoutPreview> }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const inventoryLines = Array.isArray(initial.inventoryLines) ? initial.inventoryLines as Record<string, unknown>[] : [];
  const form = useForm({
    defaultValues: {
      lines: inventoryLines.map(line => ({
        itemId: String(line.itemId),
        available: line.countedAvailableEnding == null ? '' : String(line.countedAvailableEnding),
        quarantined: line.countedQuarantinedEnding == null ? '' : String(line.countedQuarantinedEnding),
      })),
      financialDifferenceReason: String(entity.financialDifferenceReason ?? ''),
      notes: String(entity.notes ?? ''),
    },
  });
  const counts = useFieldArray({ control: form.control, name: 'lines' });
  const can = useWorkflowAccess();
  const mutation = useWorkflowWrite();
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState<string>();

  const submit = form.handleSubmit(async raw => {
    setError('');
    if (raw.lines.some(line => line.available.trim() === '' || line.quarantined.trim() === '')) { setError(t('inventory.operations.closeout.bothCountsRequired')); return; }
    const parsed = closeoutSchema.safeParse(raw);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => t(issue.message)).join('\n')); return; }
    try {
      const current = await refresh();
      const problem = validateCloseout(parsed.data, current);
      if (problem) { setError(t(problem)); setReviewed(undefined); return; }
      const signature = JSON.stringify([parsed.data, current]);
      if (reviewed !== signature) { setReviewed(signature); return; }
      await mutation.mutateAsync({ resource: 'closeouts', id: entity.id, path: 'close', method: 'post', versioned: true, version: current.version, data: parsed.data });
      setReviewed(undefined);
    } catch (failure) {
      setError(toMessage(failure));
    }
  });

  if (!can('closeout.finalize')) return <p className="text-sm text-muted-foreground">{t('inventory.operations.closeout.readOnly')}</p>;
  return (
    <FormProvider {...form}>
      <form onSubmit={submit} className="space-y-4 border-t pt-4">
        <h4 className="font-medium">{t('inventory.operations.closeout.physicalCount')}</h4>
        {error ? <p role="alert" className="whitespace-pre-line text-destructive">{error}</p> : null}
        {counts.fields.map((line, index) => (
          <fieldset key={line.id} className="grid gap-3 rounded border p-3 sm:grid-cols-3">
            <legend className="px-1 text-xs text-muted-foreground">{t('inventory.form.lineNumber', { number: index + 1 })}</legend>
            <WorkflowField field={{ name: 'itemId', reference: 'items' }} path={`lines.${index}.itemId`} />
            <label className="grid gap-1 text-sm">{t('inventory.operations.fields.available')}<Input type="number" min={0} step={1} {...form.register(`lines.${index}.available`)} /></label>
            <label className="grid gap-1 text-sm">{t('inventory.operations.fields.quarantined')}<Input type="number" min={0} step={1} {...form.register(`lines.${index}.quarantined`)} /></label>
          </fieldset>
        ))}
        <Button type="button" variant="outline" onClick={() => counts.append({ itemId: '', available: '', quarantined: '' })}>{t('inventory.operations.closeout.addFoundItem')}</Button>
        <label className="grid gap-1 text-sm">{t('inventory.operations.fields.financialDifferenceReason')}<textarea {...form.register('financialDifferenceReason')} className="min-h-20 rounded border bg-background p-2" /></label>
        <label className="grid gap-1 text-sm">{t('inventory.operations.fields.notes')}<textarea {...form.register('notes')} className="min-h-20 rounded border bg-background p-2" /></label>
        {reviewed ? <p role="status">{t('inventory.operations.closeout.reconciled')}</p> : null}
        <Button type="submit" disabled={mutation.isPending || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('inventory.operations.closeout.checking') : reviewed ? t('inventory.operations.closeout.confirmClose') : t('inventory.operations.closeout.reviewClose')}
        </Button>
      </form>
    </FormProvider>
  );
}
