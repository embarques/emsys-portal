import {
  BarChart3,
  Barcode,
  Building2,
  Boxes,
  ClipboardList,
  Container,
  FileText,
  Home,
  KeyRound,
  Package,
  PackageCheck,
  Route,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
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

export const navigation: NavigationGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/", icon: Home, permission: PERMISSIONS.dashboardView },
      { label: "Customers", href: "/customers", icon: Users, permission: PERMISSIONS.clientsView },
      { label: "Orders", href: "/orders", icon: Package, permission: PERMISSIONS.pickupsView },
      { label: "Invoices", href: "/invoices", icon: FileText, permission: PERMISSIONS.invoicesView },
      { label: "Labels", href: "/labels", icon: Barcode, permission: PERMISSIONS.packagesView },
      {
        label: "Label Updater",
        href: "/label-updater",
        icon: ScanBarcode,
        permission: PERMISSIONS.packagesView,
      },
      { label: "Inventory", href: "/inventory", icon: Boxes, permission: PERMISSIONS.inventoryView },
      { label: "Items", href: "/items", icon: Tag, permission: PERMISSIONS.invoiceItemsView },
      { label: "Containers", href: "/containers", icon: Container, permission: PERMISSIONS.containersView },
      { label: "Routes", href: "/routes", icon: Route, permission: PERMISSIONS.routesView },
      {
        label: "Route Assignments",
        href: "/route-assignments",
        icon: ClipboardList,
        permission: PERMISSIONS.dispatchView,
      },
      { label: "Trucks", href: "/trucks", icon: Truck, permission: PERMISSIONS.trucksView },
      {
        label: "Deliveries",
        href: "/deliveries",
        icon: PackageCheck,
        permission: PERMISSIONS.deliveriesView,
      },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Accounting", href: "/accounting", icon: Wallet, permission: PERMISSIONS.incomeView },
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
        label: "Configuration",
        href: "/settings",
        icon: Settings,
        permission: PERMISSIONS.accountSettingsView,
      },
    ],
  },
];
