"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useBranches, useBranchSearch } from "@/lib/branches/hooks/use-branches";
import { DEFAULT_BRANCH_LIST_PARAMS } from "@/lib/branches/types";
import type { AutomationSettings } from "@/lib/accounting/financial-activity/api";

export function CloseoutBranchSettings({ settings, onChange }: {
  settings: AutomationSettings;
  onChange: (settings: AutomationSettings) => void;
}) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission("canViewBranch", "branch");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const debounced = useDebouncedValue(search, 300);
  const branches = useBranches({ ...DEFAULT_BRANCH_LIST_PARAMS, limit: 40 }, { enabled: canView });
  const results = useBranchSearch(debounced ? { field: "name", operator: "contains", value: debounced } : undefined, { enabled: canView });
  const options = (debounced ? results.data?.items : branches.data?.items) ?? [];
  const choices = new Map<number,{id:number;name:string}>(options.map(branch => [branch.id, {id:branch.id,name:branch.name}]));
  if (selected && !choices.has(selected.id)) choices.set(selected.id, selected);
  const override = settings.branches?.find(branch => branch.id === selected?.id);
  const text = (key: string) => t(`accounting.financialActivity.${key}`);
  function save(patch: Partial<{ timezone: string; currency: string; rate: number }>) {
    if (!selected) return;
    const current = override ?? { id: selected.id, timezone: settings.timezone, currency: settings.currency, rate: settings.rate };
    onChange({ ...settings, branches: [...(settings.branches ?? []).filter(branch => branch.id !== selected.id), { ...current, ...patch }] });
  }
  if (!canView) return null;
  return <fieldset className="space-y-3 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">{text("branchOverrides")}</legend>
    <SearchableSelect options={Array.from(choices.values()).map(branch => ({ value: String(branch.id), label: branch.name }))} value={selected ? String(selected.id) : ""} onValueChange={value => { const branch = choices.get(Number(value)); if (branch) setSelected({ id: branch.id, name: branch.name }); }} onSearchChange={setSearch} manualFiltering loading={branches.isFetching || results.isFetching} placeholder={text("branch")} />
    {selected ? <>
      <Label className="flex items-center gap-2"><input type="checkbox" checked={!override} onChange={event => { if (event.target.checked) onChange({ ...settings, branches: (settings.branches ?? []).filter(branch => branch.id !== selected.id) }); else save({}); }} />{text("companyDefaults")}</Label>
      {override ? <div className="grid gap-3 sm:grid-cols-3">
        <Label>{text("timezone")}<Input value={override.timezone} required onChange={event => save({ timezone: event.target.value })} /></Label>
        <Label>{text("currency")}<select className="h-10 w-full rounded-md border bg-background px-3" value={override.currency} onChange={event => save({ currency: event.target.value })}><option>USD</option><option>DOP</option></select></Label>
        <Label>{text("rate")}<Input type="number" min="0.000001" step="any" required value={override.rate} onChange={event => save({ rate: Number(event.target.value) })} /></Label>
      </div> : null}
    </> : null}
  </fieldset>;
}
