"use client";

import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { SampleTable } from "@/components/app-shell/sample-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

type PlaceholderWorkspaceProps = {
  title: string;
};

function PlaceholderWorkspace({ title }: PlaceholderWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={title}
        description={t("insights.placeholder.description", { title })}
        actions={
          <Button>
            <Plus className="h-4 w-4" /> {t("insights.placeholder.addNew")}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("insights.placeholder.stats.total.label")}</CardTitle>
            <CardDescription>{t("insights.placeholder.stats.total.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1,248</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("insights.placeholder.stats.active.label")}</CardTitle>
            <CardDescription>{t("insights.placeholder.stats.active.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">986</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("insights.placeholder.stats.pending.label")}</CardTitle>
            <CardDescription>{t("insights.placeholder.stats.pending.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">42</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <SampleTable />
      </div>
    </div>
  );
}

export function ReportsWorkspace() {
  const { t } = useTranslation();
  return <PlaceholderWorkspace title={t("navigation.items.reports")} />;
}

export function AnalyticsWorkspace() {
  const { t } = useTranslation();
  return <PlaceholderWorkspace title={t("navigation.items.analytics")} />;
}

export function SecurityWorkspace() {
  return <PlaceholderWorkspace title="Security" />;
}
