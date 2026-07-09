"use client";

import { ScanBarcode } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

export function BarcodesWorkspace() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("navigation.items.barcodes")}
        description={t("labels.pages.barcodesDescription")}
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <ScanBarcode className="h-10 w-10 opacity-60" />
          <p className="max-w-md text-sm">{t("labels.pages.barcodesDescription")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
