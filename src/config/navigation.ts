import {
  BarChart3,
  Banknote,
  BookOpenText,
  Building2,
  Boxes,
  Car,
  Container,
  FileText,
  Home,
  KeyRound,
  Package,
  PackageCheck,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
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

export const topNavigationItems: NavigationItem[] = [
  { labelKey: "navigation.items.dashboard", href: "/", icon: Home, permission: PERMISSIONS.dashboardView },
];

/** Primary workspace shortcuts shown in the dashboard top bar (sorted alphabetically by label). */
export const topbarNavigationItems: NavigationItem[] = [
  {
    labelKey: "navigation.items.orders",
    href: "/orders",
    icon: Package,
    permission: PERMISSIONS.pickupsView,
  },
  {
    labelKey: "navigation.items.invoices",
    href: "/invoices",
    icon: FileText,
    permission: PERMISSIONS.invoicesView,
  },
  {
    labelKey: "navigation.items.barcodes",
    href: "/barcodes",
    icon: ScanBarcode,
    permission: PERMISSIONS.packagesView,
  },
  {
    labelKey: "navigation.items.dailyIncome",
    href: "/accounting/daily-income",
    icon: Wallet,
    permission: PERMISSIONS.incomeView,
  },
  {
    labelKey: "navigation.items.reports",
    href: "/reports",
    icon: FileText,
    permission: PERMISSIONS.reportsView,
  },
  {
    labelKey: "navigation.items.analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: PERMISSIONS.reportsView,
  },
];

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

const primaryNavigationItems: NavigationItem[] = [
  {
    labelKey: "navigation.submenus.inventory",
    icon: Boxes,
    children: [
      {
        labelKey: "navigation.items.inventoryStock",
        href: "/inventory/items",
        icon: Boxes,
        permission: PERMISSIONS.inventoryView,
      },
      {
        labelKey: "navigation.items.inventoryReceipts",
        href: "/inventory/receipts",
        icon: PackageCheck,
        permission: PERMISSIONS.inventoryView,
      },
      {
        labelKey: "navigation.items.inventoryDispatches",
        href: "/inventory/dispatches",
        icon: Truck,
        permission: PERMISSIONS.inventoryView,
      },
      {
        labelKey: "navigation.items.inventoryRecipients",
        href: "/inventory/recipients",
        icon: Users,
        permission: PERMISSIONS.inventoryView,
      },
      {
        labelKey: "navigation.items.inventoryReports",
        href: "/inventory/reports",
        icon: FileText,
        permission: PERMISSIONS.inventoryView,
      },
    ],
  },
  { labelKey: "navigation.items.customers", href: "/customers", icon: Users, permission: PERMISSIONS.clientsView },
  {
    labelKey: "navigation.items.orderManager",
    icon: Package,
    children: [
      {
        labelKey: "navigation.items.orders",
        href: "/orders",
        icon: Package,
        permission: PERMISSIONS.pickupsView,
      },
      {
        labelKey: "navigation.items.orderRoutes",
        href: "/pickup-routes",
        icon: Truck,
        permission: PERMISSIONS.dispatchView,
      },
    ],
  },
  {
    labelKey: "navigation.submenus.invoices",
    icon: FileText,
    children: [
      {
        labelKey: "navigation.items.invoices",
        href: "/invoices",
        icon: FileText,
        permission: PERMISSIONS.invoicesView,
      },
      {
        labelKey: "navigation.items.items",
        href: "/items",
        icon: Tag,
        permission: PERMISSIONS.invoiceItemsView,
      },
      {
        labelKey: "navigation.items.containers",
        href: "/containers",
        icon: Container,
        permission: PERMISSIONS.containersView,
      },
      {
        labelKey: "navigation.items.deliveryRoutes",
        href: "/delivery-routes",
        icon: Truck,
        permission: PERMISSIONS.dispatchView,
      },
    ],
  },
  {
    labelKey: "navigation.submenus.barcodeManager",
    icon: ScanBarcode,
    children: [
      {
        labelKey: "navigation.items.barcodes",
        href: "/barcodes",
        icon: ScanBarcode,
        permission: PERMISSIONS.packagesView,
      },
      {
        labelKey: "navigation.items.labelManager",
        href: "/label-updater",
        icon: ScanBarcode,
        permission: PERMISSIONS.packagesView,
      },
    ],
  },
  { labelKey: "navigation.items.vehicles", href: "/vehicles", icon: Car, permission: PERMISSIONS.vehiclesView },
];

const navigationGroups: NavigationGroup[] = [
  ...primaryNavigationItems.map(navigationItemToGroup),
  {
    titleKey: "navigation.groups.accounting",
    items: [
      { labelKey: "navigation.items.dailyIncome", href: "/accounting/daily-income", icon: Wallet, permission: PERMISSIONS.incomeView },
      { labelKey: "navigation.items.checks", href: "/accounting/checks", icon: Banknote, permission: PERMISSIONS.incomeView },
      { labelKey: "navigation.items.chartOfAccounts", href: "/accounting/accounts", icon: BookOpenText, permission: PERMISSIONS.accountsView },
    ],
  },
  {
    titleKey: "navigation.groups.insights",
    items: [
      { labelKey: "navigation.items.reports", href: "/reports", icon: FileText, permission: PERMISSIONS.reportsView },
      { labelKey: "navigation.items.analytics", href: "/analytics", icon: BarChart3, permission: PERMISSIONS.reportsView },
    ],
  },
  {
    titleKey: "navigation.groups.admin",
    items: [
      { labelKey: "navigation.items.users", href: "/users", icon: UserCog, permission: PERMISSIONS.usersView },
      { labelKey: "navigation.items.roles", href: "/roles", icon: KeyRound, permission: PERMISSIONS.rolesView },
      { labelKey: "navigation.items.employees", href: "/employees", icon: UserRound, permission: PERMISSIONS.employeesView },
      { labelKey: "navigation.items.security", href: "/security", icon: ShieldCheck, permission: PERMISSIONS.usersView },
      { labelKey: "navigation.items.branches", href: "/branches", icon: Building2, permission: PERMISSIONS.branchesView },
      {
        labelKey: "navigation.items.settings",
        href: "/settings",
        icon: Settings,
        permission: PERMISSIONS.accountSettingsView,
      },
    ],
  },
];

export const navigation: NavigationGroup[] = navigationGroups;
