'use client';
import { Fragment } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/feedback/messages';

function humanize(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

/** Localized label for an API field, falling back to a readable form of the key. */
export function workflowFieldLabel(t: TranslateFn, key: string) {
  const translationKey = `inventory.operations.fields.${key}`;
  const translated = t(translationKey);
  return translated === translationKey ? humanize(key) : translated;
}

/** Localized label for an API enum value (statuses, holder types, methods…). */
export function workflowOptionLabel(t: TranslateFn, value: string) {
  const translationKey = `inventory.operations.options.${value}`;
  const translated = t(translationKey);
  return translated === translationKey ? value : translated;
}

export function WorkflowData({ value, name = '' }: { value: unknown; name?: string }) {
  const { t } = useTranslation();
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number' && name.endsWith('Minor')) return <span className="tabular-nums">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100)}</span>;
  if (typeof value === 'boolean') return <span>{t(value ? 'inventory.operations.yes' : 'inventory.operations.no')}</span>;
  if (Array.isArray(value)) {
    if (value.every(entry => typeof entry !== 'object' || entry === null)) return <span>{value.length ? value.map(String).join(', ') : '—'}</span>;
    return <div className="space-y-2">{value.length ? value.map((entry, index) => <div key={index} className="rounded border p-3"><WorkflowData value={entry} /></div>) : <span className="text-muted-foreground">{t('inventory.operations.noRecords')}</span>}</div>;
  }
  if (typeof value === 'object') {
    return <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(130px,1fr)_3fr]">{Object.entries(value).map(([key, entry]) => <Fragment key={key}><dt className="text-sm text-muted-foreground">{workflowFieldLabel(t, key)}</dt><dd className="min-w-0 break-words text-sm"><WorkflowData name={key} value={entry} /></dd></Fragment>)}</dl>;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return <time dateTime={value}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))}</time>;
  if (typeof value === 'string' && /^[A-Z][A-Z_]+$/.test(value)) return <span>{workflowOptionLabel(t, value)}</span>;
  return <span>{String(value)}</span>;
}
