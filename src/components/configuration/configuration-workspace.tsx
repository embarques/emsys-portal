"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTheme } from "next-themes";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { userPreferenceSchema } from "@/lib/configuration/schema";
import { syncConfigurationStore } from "@/lib/configuration/store";
import {
  CONFIGURATION_LANGUAGES,
  CONFIGURATION_THEMES,
  DEFAULT_USER_PREFERENCES,
  MAX_MAX_WORKSPACE_TABS,
  MIN_MAX_WORKSPACE_TABS,
  type UserPreferenceValues,
} from "@/lib/configuration/types";
import { useUpdateUserPreferences, useUserPreferences } from "@/lib/configuration/use-configuration";
import { enforceWorkspaceTabLimit } from "@/lib/store/layout/tabs-slice";
import { useAppDispatch } from "@/lib/store/hooks";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

export function ConfigurationWorkspace() {
  const dispatch = useAppDispatch();
  const profileQuery = useCurrentUser();
  const preferencesQuery = useUserPreferences();
  const updatePreferences = useUpdateUserPreferences();
  const { notifySuccess } = useFeedback();
  const { setTheme } = useTheme();
  const { control, formState: { errors }, handleSubmit, reset } = useForm<UserPreferenceValues>({
    resolver: zodResolver(userPreferenceSchema),
    defaultValues: DEFAULT_USER_PREFERENCES,
  });
  useEffect(() => {
    if (preferencesQuery.data) reset(preferencesQuery.data);
  }, [preferencesQuery.data, reset]);

  async function save(next: UserPreferenceValues) {
    try {
      const saved = await updatePreferences.mutateAsync(next);
      syncConfigurationStore(saved);
      setTheme(saved.theme);
      dispatch(enforceWorkspaceTabLimit());
      notifySuccess("Settings saved.");
    } catch {
      // The mutation error is rendered below the form.
    }
  }

  if (profileQuery.isLoading || preferencesQuery.isLoading) {
    return <><PageHeader title="Settings" /><div className="py-16 text-center text-sm text-muted-foreground">Loading settings…</div></>;
  }

  const loadError = profileQuery.error ?? preferencesQuery.error;
  if (loadError) {
    return <><PageHeader title="Settings" /><div className="py-16 text-center text-sm text-destructive">{normalizeApiError(loadError).message}</div></>;
  }

  const profile = profileQuery.data;
  return (
    <div>
      <PageHeader title="Settings" />
      <form onSubmit={handleSubmit(save)} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Your tenant profile and access context.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ReadOnly label="Name" value={profile?.name} />
            <ReadOnly label="Email" value={profile?.email} />
            <ReadOnly label="Branch" value={profile?.branch.name} />
            <ReadOnly label="Role" value={profile?.role.name} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how the dashboard looks.</CardDescription></CardHeader>
          <CardContent>
            <Controller control={control} name="theme" render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-3">
                {CONFIGURATION_THEMES.map((option) => {
                  const Icon = option.value === "dark" ? Moon : option.value === "system" ? Monitor : Sun;
                  const selected = field.value === option.value;
                  return <button key={option.value} type="button" onClick={() => { field.onChange(option.value); setTheme(option.value); }} className={cn("rounded-xl border p-4 text-left", selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-muted/10 hover:bg-muted/20")}><div className="flex items-center gap-3"><Icon className={cn("size-5", selected && "text-primary")} /><div><p className="font-medium">{option.label}</p><p className="text-sm text-muted-foreground">{option.description}</p></div></div></button>;
                })}
              </div>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Language preference</CardTitle><CardDescription>Select the language used across the dashboard interface.</CardDescription></CardHeader>
          <CardContent>
            <Controller control={control} name="language" render={({ field }) => <div className="space-y-2"><Label>Language</Label><SearchableSelect value={field.value} onValueChange={field.onChange} searchable={false} options={CONFIGURATION_LANGUAGES.map((option) => ({ value: option.value, label: option.label }))} /></div>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Workspace tabs</CardTitle><CardDescription>Control how many pages can remain open in the desktop tab bar.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Label>Maximum open tabs</Label>
            <Controller control={control} name="maxWorkspaceTabs" render={({ field }) => <Input type="number" min={MIN_MAX_WORKSPACE_TABS} max={MAX_MAX_WORKSPACE_TABS} value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} aria-invalid={Boolean(errors.maxWorkspaceTabs)} />} />
            {errors.maxWorkspaceTabs ? <p className="text-sm text-destructive">{errors.maxWorkspaceTabs.message}</p> : <p className="text-xs text-muted-foreground">Choose between {MIN_MAX_WORKSPACE_TABS} and {MAX_MAX_WORKSPACE_TABS} tabs.</p>}
          </CardContent>
        </Card>

        {updatePreferences.error ? <p className="text-sm text-destructive">{normalizeApiError(updatePreferences.error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={updatePreferences.isPending} onClick={() => { reset(preferencesQuery.data ?? DEFAULT_USER_PREFERENCES); setTheme(preferencesQuery.data?.theme ?? "system"); }}>Reset changes</Button>
          <Button type="submit" disabled={updatePreferences.isPending}>{updatePreferences.isPending ? "Saving…" : "Save settings"}</Button>
        </div>
      </form>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value?: string }) {
  return <div className="space-y-1"><Label>{label}</Label><Input value={value ?? ""} readOnly /></div>;
}
