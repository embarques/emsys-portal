import {
  Banknote,
  Barcode,
  Tags,
  BookOpenText,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  Car,
  Container,
  CreditCard,
  FileChartColumn,
  HandCoins,
  History,
  Home,
  IdCard,
  KeyRound,
  Landmark,
  Layers,
  MapPinned,
  PackageMinus,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  Route,
  ScanBarcode,
  ScrollText,
  Settings,
  Smartphone,
  UserCheck,
  UserCog,
  Users,
  Warehouse,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

export type NavigationItem = {
  labelKey: string;
  href?: string;
  icon: LucideIcon;
  permission?: Permission;
  children?: NavigationItem[];
};

export type NavigationGroup = {
  titleKey: string;
  icon?: LucideIcon;
  items: NavigationItem[];
};

/** Sidebar frequency bands — order is intentional (not alphabetical). */
export type NavigationSection = {
  id: string;
  groups: NavigationGroup[];
};

export const topNavigationItems: NavigationItem[] = [
  { labelKey: "navigation.items.dashboard", href: "/", icon: Home, permission: PERMISSIONS.dashboardView },
];

/** Empty — workspace shortcuts live in the sidebar and Quick actions menu. */
export const topbarNavigationItems: NavigationItem[] = [];

function navigationItemToGroup(item: NavigationItem): NavigationGroup {
  if (item.children?.length === 1) {
    const [onlyChild] = item.children;
    return {
      titleKey: item.labelKey,
      icon: item.icon,
      items: [
        {
          ...onlyChild,
          labelKey: item.labelKey,
          icon: item.icon,
        },
      ],
    };
  }

  if (item.children?.length) {
    return {
      titleKey: item.labelKey,
      icon: item.icon,
      items: item.children,
    };
  }

  return {
    titleKey: item.labelKey,
    icon: item.icon,
    items: [item],
  };
}

const appointmentsItem: NavigationItem = {
  labelKey: "navigation.items.orders",
  href: "/appointments",
  icon: CalendarClock,
  permission: PERMISSIONS.pickupsView,
};

const invoicesItem: NavigationItem = {
  labelKey: "navigation.items.invoices",
  href: "/invoices",
  icon: PackageOpen,
  permission: PERMISSIONS.invoicesView,
};

const itemsItem: NavigationItem = {
  labelKey: "navigation.items.items",
  href: "/items",
  icon: Layers,
  permission: PERMISSIONS.invoiceItemsView,
};

const containersItem: NavigationItem = {
  labelKey: "navigation.items.containers",
  href: "/containers",
  icon: Container,
  permission: PERMISSIONS.containersView,
};

const barcodesItem: NavigationItem = {
  labelKey: "navigation.submenus.barcodeManager",
  icon: Barcode,
  children: [
    {
      labelKey: "navigation.items.barcodes",
      href: "/barcodes",
      icon: Barcode,
      permission: PERMISSIONS.packagesView,
    },
    {
      labelKey: "navigation.items.labelManager",
      href: "/label-updater",
      icon: ScanBarcode,
      permission: PERMISSIONS.packagesView,
    },
    {
      labelKey: "navigation.items.barcodeStatuses",
      href: "/barcode-statuses",
      icon: Tags,
      permission: PERMISSIONS.barcodeStatusesView,
    },
  ],
};

const inventoryItem: NavigationItem = {
  labelKey: "navigation.submenus.inventory",
  icon: Warehouse,
  children: [
    {
      labelKey: "navigation.items.pendingInventoryTransactions",
      href: "/inventory/pending-transactions",
      icon: PackageCheck,
      permission: PERMISSIONS.inventoryDispatchesList,
    },
    { labelKey: "navigation.items.inventoryWorkflow", href: "/inventory/workflow", icon: Boxes, permission: PERMISSIONS.inventoryWorkflowRead },
    {
      labelKey: "navigation.items.inventoryStock",
      href: "/inventory/items",
      icon: Boxes,
      permission: PERMISSIONS.inventoryStockList,
    },
    {
      labelKey: "navigation.items.inventoryReceipts",
      href: "/inventory/receipts",
      icon: PackagePlus,
      permission: PERMISSIONS.inventoryReceiptsList,
    },
    {
      labelKey: "navigation.items.inventoryDispatches",
      href: "/inventory/dispatches",
      icon: PackageMinus,
      permission: PERMISSIONS.inventoryDispatchesList,
    },
    {
      labelKey: "navigation.items.inventorySuppliers",
      href: "/inventory/suppliers",
      icon: UserCheck,
      permission: PERMISSIONS.inventorySuppliersList,
    },
  ],
};

const routesItem: NavigationItem = {
  labelKey: "navigation.submenus.routes",
  icon: Route,
  children: [
    {
      labelKey: "navigation.items.routeCrews",
      href: "/routes",
      icon: Users,
      permission: PERMISSIONS.dispatchView,
    },
    {
      labelKey: "navigation.items.dailyRoutes",
      href: "/daily-routes",
      icon: MapPinned,
      permission: PERMISSIONS.dispatchView,
    },
    {
      labelKey: "navigation.items.deliveries",
      href: "/deliveries",
      icon: PackageCheck,
      permission: PERMISSIONS.deliveriesView,
    },
    {
      labelKey: "navigation.items.predefinedRoutes",
      href: "/predefined-routes",
      icon: History,
      permission: PERMISSIONS.predefinedRoutesView,
    },
  ],
};

const customersItem: NavigationItem = {
  labelKey: "navigation.items.customers",
  href: "/customers",
  icon: Users,
  permission: PERMISSIONS.clientsView,
};

const vehiclesItem: NavigationItem = {
  labelKey: "navigation.items.vehicles",
  href: "/vehicles",
  icon: Car,
  permission: PERMISSIONS.vehiclesView,
};

const reportsItem: NavigationItem = {
  labelKey: "navigation.items.reports",
  href: "/reports",
  icon: FileChartColumn,
  permission: PERMISSIONS.reportsView,
};

const accountingGroup: NavigationGroup = {
  titleKey: "navigation.groups.accounting",
  icon: Calculator,
  items: [
 {labelKey:"navigation.items.pendingFinancialActivity",href:"/accounting/pending-financial-activity",icon:HandCoins,permission:PERMISSIONS.journalsView},
    {
      labelKey: "navigation.items.dailyIncome",
      href: "/accounting/daily-income",
      icon: HandCoins,
      permission: PERMISSIONS.incomeView,
    },
    {
      labelKey: "navigation.items.loans",
      href: "/accounting/loans",
      icon: Banknote,
      permission: PERMISSIONS.incomeView,
    },
    {
      labelKey: "navigation.items.chartOfAccounts",
      href: "/accounting/accounts",
      icon: BookOpenText,
      permission: PERMISSIONS.accountsView,
    },
  ],
};

/**
 * Payment clearing workspaces opened from Pending Transactions.
 * Not shown in the sidebar, but still used for workspace tab labels and accents.
 */
export const accountingClearingNavigationItems: NavigationItem[] = [
  {
    labelKey: "navigation.items.checks",
    href: "/accounting/checks",
    icon: ScrollText,
    permission: PERMISSIONS.checksList,
  },
  {
    labelKey: "navigation.items.zelle",
    href: "/accounting/zelle",
    icon: Smartphone,
    permission: PERMISSIONS.zellePaymentsList,
  },
  {
    labelKey: "navigation.items.deposits",
    href: "/accounting/deposits",
    icon: Landmark,
    permission: PERMISSIONS.depositsList,
  },
  {
    labelKey: "navigation.items.creditCards",
    href: "/accounting/credit-cards",
    icon: CreditCard,
    permission: PERMISSIONS.creditCardPaymentsList,
  },
];

/**
 * Sidebar sections in usage order.
 * Dashboard stays in `topNavigationItems` above these bands.
 * Analytics is omitted — Dashboard already covers those insights.
 */
export const navigationSections: NavigationSection[] = [
  {
    id: "daily",
    groups: [
      ...[appointmentsItem, invoicesItem].map(navigationItemToGroup),
      accountingGroup,
      ...[routesItem, barcodesItem].map(navigationItemToGroup),
    ],
  },
  {
    id: "operations",
    groups: [
      reportsItem,
      inventoryItem,
      containersItem,
    ].map(navigationItemToGroup),
  },
  {
    id: "reference",
    groups: [itemsItem, vehiclesItem, customersItem].map(navigationItemToGroup),
  },
  {
    id: "admin",
    groups: [
      {
        titleKey: "navigation.groups.admin",
        icon: Briefcase,
        items: [
          {
            labelKey: "navigation.items.roles",
            href: "/roles",
            icon: KeyRound,
            permission: PERMISSIONS.rolesView,
          },
          {
            labelKey: "navigation.items.branches",
            href: "/branches",
            icon: Building2,
            permission: PERMISSIONS.branchesView,
          },
          {
            labelKey: "navigation.items.settings",
            href: "/settings",
            icon: Settings,
            permission: PERMISSIONS.accountSettingsView,
          },
          {
            labelKey: "navigation.items.invoicePolicies",
            href: "/invoice-policies",
            icon: ScrollText,
            permission: PERMISSIONS.invoicePoliciesList,
          },
        ],
      },
      {
        titleKey: "navigation.items.users",
        icon: UserCog,
        items: [
          {
            labelKey: "navigation.items.users",
            href: "/users",
            icon: UserCog,
            permission: PERMISSIONS.usersView,
          },
          {
            labelKey: "navigation.items.userActivities",
            href: "/user-activities",
            icon: ClipboardList,
            permission: PERMISSIONS.userActivitiesView,
          },
        ],
      },
      {
        titleKey: "navigation.items.employees",
        icon: IdCard,
        items: [
          {
            labelKey: "navigation.items.employees",
            href: "/employees",
            icon: IdCard,
            permission: PERMISSIONS.employeesView,
          },
          {
            labelKey: "navigation.items.employeeTitles",
            href: "/employee-titles",
            icon: IdCard,
            permission: PERMISSIONS.employeeTitlesView,
          },
          {
            labelKey: "navigation.items.employeeDepartments",
            href: "/employee-departments",
            icon: IdCard,
            permission: PERMISSIONS.employeeDepartmentsView,
          },
        ],
      },
    ],
  },
];

/** Flat group list in sidebar order (for registries / tab colors). */
export const navigation: NavigationGroup[] = navigationSections.flatMap((section) => section.groups);
