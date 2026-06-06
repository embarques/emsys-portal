import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  Home,
  Package,
  PackageCheck,
  Route,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

export const navigation = [
  { title: "Workspace", items: [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Orders", href: "/orders", icon: Package },
    { label: "Inventory", href: "/inventory", icon: Boxes },
    { label: "Routes", href: "/routes", icon: Route },
    { label: "Route Assignments", href: "/route-assignments", icon: ClipboardList },
    { label: "Trucks", href: "/trucks", icon: Truck },
    { label: "Deliveries", href: "/deliveries", icon: PackageCheck },
  ]},
  { title: "Insights", items: [
    { label: "Reports", href: "/reports", icon: FileText },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
  ]},
  { title: "Admin", items: [
    { label: "Employee Groups", href: "/employee-groups", icon: UserRound },
    { label: "Security", href: "/security", icon: ShieldCheck },
    { label: "Settings", href: "/settings", icon: Settings },
  ]},
];
