"use client";

import { Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { SampleTable } from "@/components/app-shell/sample-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

type PlaceholderWorkspaceProps = {
  title: string;
  descriptionKey: string;
};

function PlaceholderWorkspace({ title, descriptionKey }: PlaceholderWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={title}
          description={t(descriptionKey)}
          actions={
            <Button>
              <Plus className="h-4 w-4" /> {t("insights.placeholder.addNew")}
            </Button>
          }
        />
      </div>

      <section className="mb-5 flex items-start justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{title}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t(descriptionKey)}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl">
          <Plus className="size-6" />
          <span className="sr-only">{t("insights.placeholder.addNew")}</span>
        </Button>
      </section>

      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 md:pb-6">
            <CardTitle>{t("insights.placeholder.stats.total.label")}</CardTitle>
            <CardDescription>{t("insights.placeholder.stats.total.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1,248</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 md:pb-6">
            <CardTitle>{t("insights.placeholder.stats.active.label")}</CardTitle>
            <CardDescription>{t("insights.placeholder.stats.active.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">986</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 md:pb-6">
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

export function AnalyticsWorkspace() {
  const { t } = useTranslation();
  return (
    <PlaceholderWorkspace
      title={t("navigation.items.analytics")}
      descriptionKey="insights.pages.analytics"
    />
  );
}

export function SecurityWorkspace() {
  const { t } = useTranslation();
  return (
    <PlaceholderWorkspace
      title={t("navigation.items.security")}
      descriptionKey="insights.pages.security"
    />
  );
}
