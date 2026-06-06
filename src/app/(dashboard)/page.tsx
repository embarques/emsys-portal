import { ArrowUpRight, PackageCheck, Truck, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { SampleTable } from "@/components/app-shell/sample-table";

const stats = [
  { label: "Customers", value: "2,842", change: "+12%", icon: Users },
  { label: "Open Orders", value: "384", change: "+8%", icon: PackageCheck },
  { label: "In Delivery", value: "67", change: "+4%", icon: Truck },
  { label: "Revenue", value: "$128.4k", change: "+18%", icon: WalletCards },
];
export default function DashboardPage() {
  return <div>
    <PageHeader title="Operations Dashboard" description="A clean responsive app shell using Tailwind and shadcn-style components." actions={<Button>New order <ArrowUpRight className="h-4 w-4" /></Button>} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => { const Icon = stat.icon; return <Card key={stat.label}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-primary">{stat.change}</span> from last month</p></CardContent></Card>; })}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"><SampleTable /><Card><CardHeader><CardTitle>Today&apos;s workflow</CardTitle><CardDescription>Sample timeline panel.</CardDescription></CardHeader><CardContent className="space-y-4">{["Review pending customer approvals","Prepare delivery manifest","Close inventory adjustments","Export daily report"].map((item, i) => <div key={item} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" /><div><p className="text-sm font-medium">{item}</p><p className="text-xs text-muted-foreground">Step {i + 1} of 4</p></div></div>)}</CardContent></Card></div>
  </div>;
}
