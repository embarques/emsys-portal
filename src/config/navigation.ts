import {
  BarChart3,
  BookOpenText,
  Building2,
  Boxes,
  Car,
  ClipboardList,
  Container,
  FileText,
  Home,
  KeyRound,
  Package,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Tag,
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
  href: string;
  icon: LucideIcon;
  permission?: Permission;
};

export type NavigationGroup = {
  titleKey: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    titleKey: "navigation.groups.workspace",
    items: [
      { labelKey: "navigation.items.dashboard", href: "/", icon: Home, permission: PERMISSIONS.dashboardView },
      { labelKey: "navigation.items.customers", href: "/customers", icon: Users, permission: PERMISSIONS.clientsView },
      { labelKey: "navigation.items.orders", href: "/orders", icon: Package, permission: PERMISSIONS.pickupsView },
      { labelKey: "navigation.items.invoices", href: "/invoices", icon: FileText, permission: PERMISSIONS.invoicesView },
      {
        labelKey: "navigation.items.labelManager",
        href: "/label-updater",
        icon: ScanBarcode,
        permission: PERMISSIONS.packagesView,
      },
      { labelKey: "navigation.items.inventory", href: "/inventory", icon: Boxes, permission: PERMISSIONS.inventoryView },
      { labelKey: "navigation.items.items", href: "/items", icon: Tag, permission: PERMISSIONS.invoiceItemsView },
      { labelKey: "navigation.items.containers", href: "/containers", icon: Container, permission: PERMISSIONS.containersView },
      {
        labelKey: "navigation.items.routes",
        href: "/routes",
        icon: ClipboardList,
        permission: PERMISSIONS.dispatchView,
      },
      { labelKey: "navigation.items.vehicles", href: "/vehicles", icon: Car, permission: PERMISSIONS.vehiclesView },
    ],
  },
  {
    titleKey: "navigation.groups.accounting",
    items: [
      { labelKey: "navigation.items.dailyIncome", href: "/accounting/daily-income", icon: Wallet, permission: PERMISSIONS.incomeView },
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

/** Items within each section are sorted alphabetically by label key, with Dashboard pinned first. */
export const navigation: NavigationGroup[] = navigationGroups.map((group) => ({
  ...group,
  items: [...group.items].sort((a, b) => {
    if (a.href === "/") return -1;
    if (b.href === "/") return 1;
    return a.labelKey.localeCompare(b.labelKey);
  }),
}));
