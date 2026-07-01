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
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/", icon: Home, permission: PERMISSIONS.dashboardView },
      { label: "Customers", href: "/customers", icon: Users, permission: PERMISSIONS.clientsView },
      { label: "Orders", href: "/orders", icon: Package, permission: PERMISSIONS.pickupsView },
      { label: "Invoices", href: "/invoices", icon: FileText, permission: PERMISSIONS.invoicesView },
      {
        label: "Label Manager",
        href: "/label-updater",
        icon: ScanBarcode,
        permission: PERMISSIONS.packagesView,
      },
      { label: "Inventory", href: "/inventory", icon: Boxes, permission: PERMISSIONS.inventoryView },
      { label: "Items", href: "/items", icon: Tag, permission: PERMISSIONS.invoiceItemsView },
      { label: "Containers", href: "/containers", icon: Container, permission: PERMISSIONS.containersView },
      {
        label: "Routes",
        href: "/routes",
        icon: ClipboardList,
        permission: PERMISSIONS.dispatchView,
      },
      { label: "Vehicles", href: "/vehicles", icon: Car, permission: PERMISSIONS.vehiclesView },
    ],
  },
  {
    title: "Accounting",
    items: [
      { label: "Daily Income", href: "/accounting/daily-income", icon: Wallet, permission: PERMISSIONS.incomeView },
      { label: "Chart of Accounts", href: "/accounting/accounts", icon: BookOpenText, permission: PERMISSIONS.accountsView },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: FileText, permission: PERMISSIONS.reportsView },
      { label: "Analytics", href: "/analytics", icon: BarChart3, permission: PERMISSIONS.reportsView },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Users", href: "/users", icon: UserCog, permission: PERMISSIONS.usersView },
      { label: "Roles", href: "/roles", icon: KeyRound, permission: PERMISSIONS.rolesView },
      { label: "Employees", href: "/employees", icon: UsersRound, permission: PERMISSIONS.employeesView },
      {
        label: "Employee Groups",
        href: "/employee-groups",
        icon: UserRound,
        permission: PERMISSIONS.employeesView,
      },
      { label: "Security", href: "/security", icon: ShieldCheck, permission: PERMISSIONS.usersView },
      { label: "Branches", href: "/branches", icon: Building2, permission: PERMISSIONS.branchesView },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permission: PERMISSIONS.accountSettingsView,
      },
    ],
  },
];

/** Items within each section are sorted alphabetically by label, with Dashboard pinned first. */
export const navigation: NavigationGroup[] = navigationGroups.map((group) => ({
  ...group,
  items: [...group.items].sort((a, b) => {
    if (a.href === "/") return -1;
    if (b.href === "/") return 1;
    return a.label.localeCompare(b.label);
  }),
}));
