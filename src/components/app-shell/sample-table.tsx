"use client";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

const rows = [
  { reference: "INV-1048", customer: "North Harbor Supply", amount: "$12,840", statusKey: "ready" as const },
  { reference: "INV-1047", customer: "Metro Logistics", amount: "$8,210", statusKey: "pending" as const },
  { reference: "INV-1046", customer: "Blue Coast Foods", amount: "$4,992", statusKey: "delivered" as const },
  { reference: "INV-1045", customer: "Rapid Parts Co.", amount: "$2,480", statusKey: "review" as const },
];

export function SampleTable() {
  const { t } = useTranslation();

  return (
    <>
      <Card className="overflow-hidden py-0 md:hidden">
        <CardContent className="px-4 py-0">
          {rows.map((row) => (
            <article key={row.reference} className="border-b border-border/80 py-5 last:border-b-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold leading-tight text-foreground">{row.customer}</h2>
                  <p className="mt-1 text-base text-muted-foreground">{row.reference}</p>
                  <Badge className="mt-3 rounded-full border-transparent bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {t(`insights.sampleTable.statuses.${row.statusKey}`)}
                  </Badge>
                </div>
                <p className="shrink-0 text-right text-xl font-bold text-foreground">{row.amount}</p>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="hidden overflow-hidden py-0 md:block">
        <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-muted-foreground">
              <th className="px-6 py-3 font-medium">{t("insights.sampleTable.columns.reference")}</th>
              <th className="px-6 py-3 font-medium">{t("insights.sampleTable.columns.customer")}</th>
              <th className="px-6 py-3 font-medium">{t("insights.sampleTable.columns.amount")}</th>
              <th className="px-6 py-3 font-medium">{t("insights.sampleTable.columns.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.reference} className="border-b last:border-0">
                <td className="px-6 py-4 font-medium">{row.reference}</td>
                <td className="px-6 py-4">{row.customer}</td>
                <td className="px-6 py-4">{row.amount}</td>
                <td className="px-6 py-4">
                  <TableTagText>{t(`insights.sampleTable.statuses.${row.statusKey}`)}</TableTagText>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </CardContent>
      </Card>
    </>
  );
}
