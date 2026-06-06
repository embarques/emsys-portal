import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { SampleTable } from "@/components/app-shell/sample-table";

export default function Page() {
  return <div>
    <PageHeader title="Settings" description="Sample Settings page inside the same responsive dashboard shell." actions={<Button><Plus className="h-4 w-4" /> Add new</Button>} />
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle>Total</CardTitle><CardDescription>Current records</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">1,248</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Active</CardTitle><CardDescription>Available now</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">986</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Pending</CardTitle><CardDescription>Needs review</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">42</p></CardContent></Card>
    </div>
    <div className="mt-6"><SampleTable /></div>
  </div>;
}
