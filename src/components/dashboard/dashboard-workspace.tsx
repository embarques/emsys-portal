"use client";

import { ArrowUpRight, Car, PackageCheck, Users, WalletCards } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { SampleTable } from "@/components/app-shell/sample-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

const stats = [
  { label: "Customers", value: "2,842", description: "+12% from last month", icon: Users },
  { label: "Open Orders", value: "384", description: "+8% from last month", icon: PackageCheck },
  { label: "In Delivery", value: "67", description: "+4% from last month", icon: Car },
  { label: "Revenue", value: "$128.4k", description: "+18% from last month", icon: WalletCards },
];

export function DashboardWorkspace() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t("shell.dashboard.title")}
        description={t("shell.dashboard.description")}
        actions={
          <Button>
            New order <ArrowUpRight className="h-4 w-4" />
          </Button>
        }
      />
      <StatCards items={stats} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <SampleTable />
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s workflow</CardTitle>
            <CardDescription>Sample timeline panel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Review pending customer approvals",
              "Prepare delivery manifest",
              "Close inventory adjustments",
              "Export daily report",
            ].map((item, index) => (
              <div key={item} className="flex gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{item}</p>
                  <p className="text-xs text-muted-foreground">Step {index + 1} of 4</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
