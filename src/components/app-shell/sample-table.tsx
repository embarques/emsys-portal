import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
const rows = [
  ["INV-1048", "North Harbor Supply", "$12,840", "Ready"],
  ["INV-1047", "Metro Logistics", "$8,210", "Pending"],
  ["INV-1046", "Blue Coast Foods", "$4,992", "Delivered"],
  ["INV-1045", "Rapid Parts Co.", "$2,480", "Review"],
];
export function SampleTable() {
  return <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/50 text-left text-muted-foreground"><th className="px-6 py-3 font-medium">Reference</th><th className="px-6 py-3 font-medium">Customer</th><th className="px-6 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Status</th></tr></thead><tbody>{rows.map((r) => <tr key={r[0]} className="border-b last:border-0"><td className="px-6 py-4 font-medium">{r[0]}</td><td className="px-6 py-4">{r[1]}</td><td className="px-6 py-4">{r[2]}</td><td className="px-6 py-4"><Badge variant="secondary">{r[3]}</Badge></td></tr>)}</tbody></table></CardContent></Card>;
}
