'use client';
import { useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { areFormValuesEquivalent } from '@/lib/forms/are-form-values-equivalent';
import { useFeedback } from '@/components/app-shell/feedback-provider';
import type { Command, Field, Resource, WorkflowRecord } from '../types/workflow';
import { toPayload, workflowSchema } from '../schemas/workflow-schema';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowErrorMessage, useWorkflowWrite } from '../hooks/use-workflow';
import { WorkflowData } from './workflow-data';
import { WorkflowField } from './workflow-field';

export type WorkflowFormTarget =
  | { mode: 'create'; resource: Resource }
  | { mode: 'edit'; resource: Resource; entity: WorkflowRecord }
  | { mode: 'command'; resource: Resource; entity: WorkflowRecord; command: Command };

const STOCK_CONTEXT_RESOURCES = ['dispatches', 'returns', 'dispositions', 'sales-reports'];

function PriceGroups({ index }: { index: number }) {
  const { t } = useTranslation();
  const { control } = useFormContext();
  const groups = useFieldArray({ control, name: `lines.${index}.priceBreakdowns` });
  const pricingMode = useWatch({ name: `lines.${index}.pricingMode` });
  if (pricingMode !== 'PRICE_GROUPS') return null;
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm">{t('inventory.operations.priceGroupsHint')}</p>
      {groups.fields.map((group, groupIndex) => (
        <div key={group.id} className="flex flex-wrap items-end gap-2">
          <WorkflowField field={{ name: 'quantity', labelKey: 'groupQuantity', kind: 'number', min: 1 }} path={`lines.${index}.priceBreakdowns.${groupIndex}.quantity`} />
          <WorkflowField field={{ name: 'unitPriceMinor', kind: 'money' }} path={`lines.${index}.priceBreakdowns.${groupIndex}.unitPriceMinor`} />
          <Button variant="ghost" type="button" onClick={() => groups.remove(groupIndex)}>{t('inventory.operations.removeGroup')}</Button>
        </div>
      ))}
      <Button variant="outline" type="button" onClick={() => groups.append({ quantity: '', unitPriceMinor: '' })}>{t('inventory.operations.addGroup')}</Button>
    </div>
  );
}

function toInputValue(field: Field, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (field.kind === 'money') return (Number(value) / 100).toFixed(2);
  if (field.kind === 'datetime-local') {
    const instant = new Date(String(value));
    if (Number.isNaN(instant.getTime())) return '';
    return new Date(instant.getTime() - instant.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  if (field.kind === 'date') return String(value).slice(0, 10);
  return String(value);
}

function defaults(fields: Field[], entity?: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => [field.name, toInputValue(field, entity?.[field.name])]));
}

/** Count submission resubmits the draft's own lines (`inventory.CountSubmission`). */
function entityLines(entity: WorkflowRecord) {
  const lines = Array.isArray(entity.lines) ? (entity.lines as Record<string, unknown>[]) : [];
  return { lines: lines.map(line => ({ itemId: line.itemId, condition: line.condition, countedQuantity: line.countedQuantity })) };
}

export function WorkflowForm({ target, onDone }: { target: WorkflowFormTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const { resource } = target;
  const command = target.mode === 'command' ? target.command : undefined;
  const entity = target.mode === 'create' ? undefined : target.entity;
  const fields = useMemo(() => (command ? command.fields ?? [] : resource.fields ?? []), [command, resource.fields]);
  const lineFields = command ? command.lines : resource.lines;
  const shape = { key: command?.action ?? resource.key, fields, lines: lineFields };
  const sourceLines = target.mode === 'edit' ? entity?.[resource.linesKey ?? 'lines'] : undefined;

  const initial = useMemo(() => ({
    ...defaults(fields, target.mode === 'edit' ? entity : undefined),
    ...(lineFields
      ? {
          lines: Array.isArray(sourceLines) && sourceLines.length
            ? (sourceLines as Record<string, unknown>[]).map(line => ({
                ...defaults(lineFields, line),
                ...(resource.key === 'sales-reports'
                  ? { priceBreakdowns: ((line.priceBreakdowns ?? []) as { quantity: number; unitPriceMinor: number }[]).map(group => ({ quantity: String(group.quantity), unitPriceMinor: (group.unitPriceMinor / 100).toFixed(2) })) }
                  : {}),
              }))
            : [defaults(lineFields)],
        }
      : {}),
  }), [entity, fields, lineFields, resource.key, sourceLines, target.mode]);

  const form = useForm<Record<string, unknown>>({ defaultValues: initial });
  const lines = useFieldArray({ control: form.control, name: 'lines' as never });
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const mutation = useWorkflowWrite();
  const { notifySuccess } = useFeedback();
  const resourceLabel = t(`inventory.operations.resources.${resource.key}.label`);
  const title = command
    ? t(`inventory.operations.commands.${command.action}`)
    : target.mode === 'edit' ? t('inventory.operations.editTitle', { resource: resourceLabel }) : t('inventory.operations.createTitle', { resource: resourceLabel });

  function buildData(values: Record<string, unknown>): Record<string, unknown> | undefined | null {
    if (command?.body === 'none') return undefined;
    if (command?.body === 'entity-lines' && entity) return entityLines(entity);
    const parsed = workflowSchema(shape).safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach(issue => form.setError(issue.path.join('.'), { message: issue.message }));
      setError(parsed.error.issues.map(issue => t(issue.message)).filter((message, index, all) => all.indexOf(message) === index).join('\n'));
      return null;
    }
    const data = parsed.data as Record<string, unknown>;
    if (command) return { ...data, ...command.fixed };
    return toPayload(resource, data, target.mode === 'edit' ? entity : undefined);
  }

  const submit = form.handleSubmit(async values => {
    setError('');
    form.clearErrors();
    if (target.mode === 'edit' && areFormValuesEquivalent(values, initial)) {
      notifySuccess(t('common.form.noChanges'));
      onDone();
      return;
    }
    const data = buildData(values);
    if (data === null) return;
    if (!review) { setReview(data ?? {}); return; }
    try {
      if (target.mode === 'create') {
        await mutation.mutateAsync({ resource: resource.key, method: 'post', data });
      } else if (target.mode === 'edit') {
        await mutation.mutateAsync({ resource: resource.key, id: target.entity.id, method: resource.editMethod ?? 'patch', versioned: true, version: target.entity.version, data });
      } else {
        await mutation.mutateAsync({ resource: resource.key, id: target.entity.id, path: target.command.path ?? target.command.action, method: 'post', versioned: Boolean(target.command.versioned), version: target.entity.version, data });
      }
      notifySuccess(t('inventory.operations.saved'));
      onDone();
    } catch (failure) {
      setError(toMessage(failure));
    }
  });

  const hasInputs = fields.length > 0 || Boolean(lineFields);

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
        <h3 className="font-semibold">{title}</h3>
        {error ? <p role="alert" className="whitespace-pre-line text-sm text-destructive">{error}</p> : null}
        {review ? (
          <>
            <p className="text-sm">{t(command && !hasInputs ? 'inventory.operations.confirmCommand' : 'inventory.operations.reviewHint')}</p>
            {Object.keys(review).length ? <WorkflowData value={review} /> : null}
            <Button type="button" variant="outline" onClick={() => setReview(null)} disabled={mutation.isPending}>{t('inventory.operations.backToEdit')}</Button>
          </>
        ) : (
          <>
            {command && !hasInputs ? <p className="text-sm text-muted-foreground">{t(`inventory.operations.commandHints.${command.action}`)}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <WorkflowField key={field.name} field={field} />)}</div>
            {lineFields ? <StockAvailability resourceKey={command?.action === 'reassign' ? 'reassign' : resource.key} holderId={command?.action === 'reassign' ? entity?.id : undefined} /> : null}
            {lineFields ? (
              <div className="space-y-3">
                {lines.fields.map((line, index) => (
                  <fieldset key={line.id} className="grid gap-3 rounded border p-3 sm:grid-cols-2">
                    <legend className="px-1 text-xs text-muted-foreground">{t('inventory.form.lineNumber', { number: index + 1 })}</legend>
                    {lineFields.map(field => <WorkflowField key={field.name} field={field} path={`lines.${index}.${field.name}`} />)}
                    {resource.key === 'sales-reports' && !command ? <PriceGroups index={index} /> : null}
                    <Button type="button" variant="ghost" disabled={lines.fields.length <= 1} onClick={() => lines.remove(index)}>{t('inventory.form.removeLine')}</Button>
                  </fieldset>
                ))}
                <Button type="button" variant="outline" onClick={() => lines.append(defaults(lineFields) as never)}>{t('inventory.form.addLine')}</Button>
              </div>
            ) : null}
          </>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.actions.saving') : review ? t('inventory.operations.confirm') : command && !hasInputs ? t(`inventory.operations.commands.${command.action}`) : t('inventory.operations.review')}
          </Button>
          <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>{t('common.actions.cancel')}</Button>
        </div>
      </form>
    </FormProvider>
  );
}

function StockAvailability({ resourceKey, holderId: fixedHolderId }: { resourceKey: string; holderId?: string }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const can = useWorkflowAccess();
  const fromHolderId = useWatch({ name: 'fromHolderId' }) as string | undefined;
  const holderField = useWatch({ name: 'holderId' }) as string | undefined;
  const holderId = fixedHolderId ?? (fromHolderId || holderField);
  const enabled = resourceKey === 'reassign' || STOCK_CONTEXT_RESOURCES.includes(resourceKey);
  const stock = useWorkflowDetail('holders', holderId, 'stock', enabled && can('inventory.read'));
  if (!holderId || !enabled) return null;
  return (
    <details className="rounded border p-3" open>
      <summary className="text-sm font-medium">{t('inventory.operations.currentHolderStock')}</summary>
      {stock.isPending ? <p role="status">{t('common.loading')}</p> : stock.isError ? <p role="alert">{toMessage(stock.error)}</p> : <WorkflowData value={stock.data?.data} />}
    </details>
  );
}
