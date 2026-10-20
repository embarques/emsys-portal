import type { Command, Field, Resource } from './types/workflow';

/*
 * Supply-operations resources as published in the live Swagger. Labels and
 * descriptions are localized from `inventory.operations.resources.<key>`.
 * Named capabilities documented by Swagger: inventory.read, sales.read,
 * payments.read, payments.allocate, payments.handover, payments.handover.receive,
 * collections.read, closeout.read, closeout.reopen, reports.read, audit.read,
 * routes.read. The remaining write capabilities follow inventory.md.
 */

const ref = (name: string, reference: Field['reference'], optional = false, labelKey?: string): Field => ({ name, reference, optional, labelKey });
const text = (name: string, optional = false, labelKey?: string): Field => ({ name, optional, labelKey });
const date = (name = 'businessDate', optional = false): Field => ({ name, kind: 'date', optional });
const instant = (name: string, optional = false): Field => ({ name, kind: 'datetime-local', optional });
const select = (name: string, options: readonly string[], optional = false, labelKey?: string): Field => ({ name, kind: 'select', options, optional, labelKey });
const money = (name: string): Field => ({ name, kind: 'money', min: 0 });
const quantity = (name = 'quantity', min = 1): Field => ({ name, kind: 'number', min });

export const HOLDER_TYPES = ['WAREHOUSE', 'EMPLOYEE', 'VEHICLE', 'ROUTE_CREW'] as const;
export const DOCUMENT_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export const STOCK_CONDITIONS = ['AVAILABLE', 'QUARANTINED'] as const;
export const PAYMENT_METHODS = ['CASH', 'CHECK', 'BANK_DEPOSIT', 'ZELLE', 'CREDIT_CARD'] as const;
export const PAYMENT_STATUSES = ['RECORDED', 'VERIFIED', 'REJECTED', 'VOIDED'] as const;
export const HANDOVER_STATUSES = ['PENDING', 'RECEIVED'] as const;
export const OBLIGATION_STATUSES = ['OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'VOIDED'] as const;
export const CLOSEOUT_STATUSES = ['OPEN', 'CLOSED', 'REOPENED'] as const;
export const COUNT_STATUSES = ['DRAFT', 'SUBMITTED'] as const;
/** SOLD dispositions are produced by posting a sales report, never entered manually. */
export const MANUAL_DISPOSITION_TYPES = ['LOST', 'MISSING', 'STOLEN', 'DAMAGED'] as const;
export const DAMAGE_RESOLUTIONS = ['QUARANTINE', 'WRITE_OFF'] as const;
export const PRICING_MODES = ['TOTAL_PER_ITEM', 'PRICE_GROUPS'] as const;
export const ALLOCATION_TARGETS = ['SALES_REPORT', 'COLLECTION_OBLIGATION'] as const;
/** Swagger types crew roles as free strings; these are the roles defined in inventory.md. */
export const CREW_ROLES = ['driver', 'appraiser', 'helper'] as const;

const item = ref('itemId', 'items');
const holder = ref('holderId', 'holders');
const condition = select('condition', STOCK_CONDITIONS);
const statusFilter = (options: readonly string[]) => select('status', options, true);

/** Draft documents: post (If-Match + Idempotency-Key) or cancel (If-Match). */
const draftCommands = (permission: string, postPermission = 'inventory.post'): Command[] => [
  { action: 'post', permission: postPermission, states: ['DRAFT'], versioned: true, body: 'none' },
  { action: 'cancel', permission, states: ['DRAFT'], versioned: true, body: 'none' },
];

export const resources: Resource[] = [
  {
    key: 'holders',
    read: 'inventory.read',
    create: 'inventory.holder.manage',
    fields: [select('type', HOLDER_TYPES, false, 'holderType'), ref('entityId', 'holder-entity', true), text('displayName')],
    filters: [select('type', HOLDER_TYPES, true, 'holderType')],
    children: [{ path: 'stock' }, { path: 'movements' }, { path: 'custody-assignments' }],
    commands: [
      {
        action: 'custody-assignments',
        permission: 'inventory.reassign',
        fields: [ref('responsibleEmployeeId', 'employees'), instant('effectiveFrom'), instant('effectiveTo', true), text('reason')],
      },
      {
        action: 'reassign',
        permission: 'inventory.reassign',
        fields: [ref('toHolderId', 'holders'), text('reason'), instant('occurredAt')],
        lines: [item, quantity(), condition],
      },
    ],
  },
  {
    key: 'items',
    read: 'inventory.read',
    create: 'catalog.manage',
    edit: 'catalog.manage',
    editMethod: 'patch',
    fields: [text('sku'), text('name'), text('unitOfMeasure'), text('category'), money('defaultSellingPriceMinor'), quantity('reorderThreshold', 0)],
    children: [{ path: 'prices' }],
    commands: [
      { action: 'prices', permission: 'catalog.manage', fields: [money('priceMinor'), instant('effectiveFrom'), instant('effectiveTo', true)] },
    ],
  },
  {
    key: 'suppliers',
    read: 'inventory.read',
    create: 'catalog.manage',
    edit: 'catalog.manage',
    editMethod: 'patch',
    fields: [text('companyName')],
  },
  {
    key: 'stock',
    read: 'inventory.read',
    readOnly: true,
    filters: [ref('holderId', 'holders', true), ref('itemId', 'items', true), select('condition', STOCK_CONDITIONS, true)],
  },
  {
    key: 'receipts',
    read: 'inventory.read',
    create: 'inventory.create',
    edit: 'inventory.create',
    editMethod: 'patch',
    editStates: ['DRAFT'],
    fields: [ref('supplierId', 'suppliers'), ref('toHolderId', 'warehouse', false, 'warehouseHolderId'), instant('receivedAt'), text('notes', true)],
    lines: [item, quantity(), money('unitCostMinor')],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('toHolderId', 'warehouse', true, 'warehouseHolderId')],
    commands: draftCommands('inventory.create'),
  },
  {
    key: 'dispatches',
    read: 'inventory.read',
    create: 'inventory.create',
    edit: 'inventory.create',
    editMethod: 'patch',
    editStates: ['DRAFT'],
    fields: [
      ref('fromHolderId', 'warehouse', false, 'sourceWarehouseId'),
      ref('toHolderId', 'custodian', false, 'destinationHolderId'),
      ref('assigneeEmployeeId', 'employees', true),
      ref('dailyRouteId', 'daily-routes', true),
      instant('dispatchedAt'),
      text('notes', true),
    ],
    lines: [item, quantity()],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('fromHolderId', 'warehouse', true, 'sourceWarehouseId'), ref('toHolderId', 'custodian', true, 'destinationHolderId')],
    commands: draftCommands('inventory.create'),
  },
  {
    key: 'returns',
    read: 'inventory.read',
    create: 'inventory.create',
    fields: [ref('fromHolderId', 'custodian', false, 'originHolderId'), ref('toWarehouseHolderId', 'warehouse'), instant('returnedAt'), text('notes', true)],
    lines: [item, quantity(), condition],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('fromHolderId', 'custodian', true, 'originHolderId')],
    commands: draftCommands('inventory.create'),
  },
  {
    key: 'dispositions',
    read: 'inventory.read',
    create: 'inventory.adjust',
    fields: [
      holder,
      select('type', MANUAL_DISPOSITION_TYPES, false, 'dispositionType'),
      text('description'),
      instant('occurredAt'),
      ref('closeoutId', 'closeouts', true),
      ref('dailyRouteId', 'daily-routes', true),
    ],
    lines: [item, quantity(), select('damageResolution', DAMAGE_RESOLUTIONS, true), text('description', true, 'lineDescription')],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('holderId', 'holders', true)],
    commands: draftCommands('inventory.adjust', 'inventory.adjust'),
  },
  {
    key: 'counts',
    read: 'inventory.read',
    create: 'inventory.count',
    fields: [holder, date()],
    lines: [item, condition, quantity('countedQuantity', 0)],
    filters: [statusFilter(COUNT_STATUSES), ref('holderId', 'holders', true), date('businessDate', true)],
    commands: [{ action: 'submit', permission: 'inventory.count', states: ['DRAFT'], versioned: true, body: 'entity-lines' }],
  },
  {
    key: 'adjustments',
    read: 'inventory.read',
    create: 'inventory.adjust',
    fields: [holder, text('reason'), text('description', true), instant('occurredAt')],
    lines: [item, condition, { name: 'quantityDelta', kind: 'number' }],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('holderId', 'holders', true)],
    commands: draftCommands('inventory.adjust', 'inventory.adjust'),
  },
  {
    key: 'sales-reports',
    read: 'sales.read',
    create: 'sales.record',
    fields: [holder, date(), ref('closeoutId', 'closeouts', true), text('notes', true)],
    lines: [item, quantity('quantitySold'), select('pricingMode', PRICING_MODES), money('totalRevenueMinor')],
    filters: [statusFilter(DOCUMENT_STATUSES), ref('holderId', 'holders', true), date('businessDate', true)],
    commands: draftCommands('sales.record', 'sales.post'),
  },
  {
    key: 'payments',
    read: 'payments.read',
    create: 'payments.record',
    fields: [
      select('method', PAYMENT_METHODS, false, 'paymentMethod'),
      money('amountMinor'),
      text('reference', true),
      ref('collectedByEmployeeId', 'employees'),
      instant('collectedAt'),
    ],
    filters: [statusFilter(PAYMENT_STATUSES), select('method', PAYMENT_METHODS, true, 'paymentMethod'), ref('collectedByEmployeeId', 'employees', true)],
    children: [{ path: 'allocations' }],
    commands: [
      { action: 'verify', path: 'status', permission: 'payments.verify', states: ['RECORDED'], fixed: { status: 'VERIFIED' }, versioned: true },
      { action: 'reject', path: 'status', permission: 'payments.verify', states: ['RECORDED'], fixed: { status: 'REJECTED' }, versioned: true },
      { action: 'void', path: 'status', permission: 'payments.manage', states: ['RECORDED', 'VERIFIED'], fixed: { status: 'VOIDED' }, versioned: true },
      {
        action: 'allocate',
        path: 'allocations',
        permission: 'payments.allocate',
        states: ['RECORDED', 'VERIFIED'],
        versioned: true,
        fields: [select('targetType', ALLOCATION_TARGETS, false, 'allocationTargetType'), ref('targetId', 'allocation-target', false, 'allocationTargetId'), money('amountMinor')],
      },
    ],
  },
  {
    key: 'cash-handovers',
    read: 'payments.read',
    create: 'payments.handover',
    fields: [
      ref('fromEmployeeId', 'employees'),
      ref('toEmployeeId', 'employees'),
      select('method', ['CASH', 'CHECK'], false, 'paymentMethod'),
      money('amountMinor'),
      text('paymentIds'),
      instant('handedAt'),
    ],
    filters: [statusFilter(HANDOVER_STATUSES), ref('toEmployeeId', 'employees', true)],
    commands: [{ action: 'receive', permission: 'payments.handover.receive', states: ['PENDING'], versioned: true, body: 'none' }],
  },
  {
    key: 'collection-obligations',
    read: 'collections.read',
    create: 'collections.manage',
    fields: [ref('closeoutId', 'closeouts'), text('description'), ref('paymentId', 'payments', true)],
    filters: [statusFilter(OBLIGATION_STATUSES), ref('responsibleEmployeeId', 'employees', true)],
    children: [{ path: 'settlements' }],
    commands: [
      {
        action: 'settlements',
        permission: 'collections.settle',
        states: ['OPEN', 'PARTIALLY_SETTLED'],
        versioned: true,
        fields: [ref('paymentId', 'verified-payments', true), ref('handoverId', 'received-handovers', true), money('amountMinor')],
      },
    ],
  },
  {
    key: 'closeouts',
    read: 'closeout.read',
    create: 'closeout.record',
    fields: [holder, date(), ref('accountableEmployeeId', 'employees'), ref('dailyRouteId', 'daily-routes', true), instant('cutoffAt', true), text('timezone', true)],
    filters: [statusFilter(CLOSEOUT_STATUSES), ref('holderId', 'holders', true), date('businessDate', true)],
    commands: [{ action: 'reopen', permission: 'closeout.reopen', states: ['CLOSED'], versioned: true, fields: [text('reason', false, 'reopenReason')] }],
  },
  {
    key: 'route-crews',
    read: 'routes.read',
    create: 'routes.manage',
    edit: 'routes.manage',
    editMethod: 'put',
    fields: [text('name', false, 'crewName')],
    children: [{ path: 'members' }],
    commands: [
      {
        action: 'members',
        permission: 'routes.manage',
        fields: [ref('employeeId', 'employees'), select('role', CREW_ROLES, false, 'crewRole'), instant('effectiveFrom'), instant('effectiveTo', true)],
      },
    ],
  },
  {
    key: 'daily-routes',
    read: 'routes.read',
    create: 'routes.manage',
    edit: 'routes.manage',
    editMethod: 'put',
    fields: [date(), ref('vehicleId', 'vehicles'), ref('crewId', 'route-crews', true)],
    lines: [ref('employeeId', 'employees'), select('role', CREW_ROLES, false, 'crewRole')],
    linesKey: 'members',
    filters: [date('businessDate', true)],
  },
];

export const reportResources: Resource[] = [
  { key: 'reports/stock-valuation', read: 'reports.read', readOnly: true, filters: [ref('holderId', 'holders', true), ref('itemId', 'items', true)] },
  { key: 'reports/sales', read: 'reports.read', readOnly: true, filters: [ref('holderId', 'holders', true), date('businessDate', true)] },
  { key: 'reports/obligations', read: 'reports.read', readOnly: true, filters: [statusFilter(OBLIGATION_STATUSES), ref('responsibleEmployeeId', 'employees', true)] },
  { key: 'reports/discrepancies', read: 'reports.read', readOnly: true, filters: [ref('holderId', 'holders', true), date('businessDate', true)] },
];

export const allResources: Resource[] = [
  ...resources,
  ...reportResources,
  { key: 'audit-events', read: 'audit.read', readOnly: true },
  { key: 'journal-entries', read: 'reports.read', readOnly: true },
];
