'use client';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { useWorkflowAccess, useWorkflowDetail, useWorkflowErrorMessage, useWorkflowWrite } from '../hooks/use-workflow';
import type { ChildList, Resource, WorkflowRecord } from '../types/workflow';
import { WorkflowData } from './workflow-data';

/** Read-only sub-collections (`GET {resource}/{id}/{path}`) shown under a record. */
export function WorkflowChildren({ resource, entity }: { resource: Resource; entity: WorkflowRecord }) {
  if (!resource.children?.length) return null;
  return (
    <div className="space-y-4">
      {resource.children.map(child => (
        <WorkflowChild key={child.path} resource={resource} entity={entity} child={child} />
      ))}
    </div>
  );
}

function WorkflowChild({ resource, entity, child }: { resource: Resource; entity: WorkflowRecord; child: ChildList }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const query = useWorkflowDetail(resource.key, entity.id, child.path);
  const rows = Array.isArray(query.data?.data) ? (query.data.data as unknown as WorkflowRecord[]) : [];
  return (
    <section className="space-y-2">
      <h4 className="font-semibold">{t(`inventory.operations.children.${child.path}`)}</h4>
      {query.isPending ? <p role="status">{t('common.loading')}</p> : query.isError ? (
        <p role="alert">{toMessage(query.error)} <Button variant="link" onClick={() => query.refetch()}>{t('inventory.operations.retry')}</Button></p>
      ) : resource.key === 'payments' && child.path === 'allocations' ? (
        <PaymentAllocations payment={entity} allocations={rows} />
      ) : (
        <WorkflowData value={rows} />
      )}
    </section>
  );
}

/** Unused allocations can be released (`DELETE /inventory/payments/{id}/allocations/{allocationId}`). */
function PaymentAllocations({ payment, allocations }: { payment: WorkflowRecord; allocations: WorkflowRecord[] }) {
  const { t } = useTranslation();
  const toMessage = useWorkflowErrorMessage();
  const can = useWorkflowAccess();
  const release = useWorkflowWrite();
  if (!allocations.length) return <p className="text-sm text-muted-foreground">{t('inventory.operations.noRecords')}</p>;
  return (
    <div className="space-y-2">
      {release.isError ? <p role="alert" className="text-sm text-destructive">{toMessage(release.error)}</p> : null}
      {allocations.map(allocation => (
        <div key={allocation.id} className="flex flex-wrap items-start justify-between gap-3 rounded border p-3">
          <WorkflowData value={allocation} />
          {can('payments.allocate') ? (
            <Button
              variant="outline"
              size="sm"
              disabled={release.isPending}
              onClick={() => release.mutate({
                resource: 'payments',
                id: payment.id,
                path: `allocations/${encodeURIComponent(allocation.id)}`,
                method: 'delete',
                versioned: true,
                version: payment.version,
              })}
            >
              {t('inventory.operations.releaseAllocation')}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
