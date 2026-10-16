import { Fragment } from 'react';
export function fieldLabel(key: string) { return key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' '); }
export function WorkflowData({ value, name = '' }: { value: unknown; name?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number' && (name.endsWith('Minor') || ['defaultSellingPrice', 'price'].includes(name))) return <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100)}</span>;
  if (Array.isArray(value)) return <div className="space-y-2">{value.length ? value.map((entry, index) => <div key={index} className="rounded border p-3"><WorkflowData value={entry} /></div>) : <span className="text-muted-foreground">No records</span>}</div>;
  if (typeof value === 'object') return <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(130px,1fr)_3fr]">{Object.entries(value).map(([key, entry]) => <Fragment key={key}><dt className="text-sm capitalize text-muted-foreground">{fieldLabel(key)}</dt><dd className="min-w-0 break-words text-sm"><WorkflowData name={key} value={entry} /></dd></Fragment>)}</dl>;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return <time dateTime={value}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' }).format(new Date(value))}</time>;
  return <span>{String(value)}</span>;
}
