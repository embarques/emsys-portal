"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useMemo } from "react";
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
import { createUserPreferenceSchema } from "@/lib/configuration/schema";
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
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useTranslation } from "@/lib/i18n";
import { enforceWorkspaceTabLimit } from "@/lib/store/layout/tabs-slice";
import { useAppDispatch } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

export function ConfigurationWorkspace() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preferencesQuery = useUserPreferences();
  const updatePreferences = useUpdateUserPreferences();
  const { notifySuccess } = useFeedback();
  const { setTheme } = useTheme();
  const schema = useMemo(() => createUserPreferenceSchema(t), [t]);
  const { control, formState: { errors }, handleSubmit, reset } = useForm<UserPreferenceValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_USER_PREFERENCES,
  });
  useEffect(() => {
    if (preferencesQuery.data) reset(preferencesQuery.data);
  }, [preferencesQuery.data, reset]);

  async function save(next: UserPreferenceValues) {
    try {
      const current = preferencesQuery.data
        ? {
            language: preferencesQuery.data.language,
            theme: preferencesQuery.data.theme,
            maxWorkspaceTabs: preferencesQuery.data.maxWorkspaceTabs,
          }
        : null;
      if (current && areFormValuesEquivalent(next, current)) {
        notifySuccess(t("common.form.noChanges"));
        return;
      }
      const saved = await updatePreferences.mutateAsync(next);
      syncConfigurationStore(saved);
      setTheme(saved.theme);
      dispatch(enforceWorkspaceTabLimit());
      notifySuccess(t("settings.toast.saved"));
    } catch {
      // The mutation error is rendered below the form.
    }
  }

  if (preferencesQuery.isLoading) {
    return (
      <>
        <PageHeader title={t("settings.title")} description={t("settings.pages.description")} />
        <div className="py-16 text-center text-sm text-muted-foreground">{t("settings.loading")}</div>
      </>
    );
  }

  const loadError = preferencesQuery.error;
  if (loadError) {
    return (
      <>
        <PageHeader title={t("settings.title")} description={t("settings.pages.description")} />
        <div className="py-16 text-center text-sm text-destructive">{normalizeApiError(loadError).message}</div>
      </>
    );
  }

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.pages.description")} />
      <div className="mx-auto max-w-3xl space-y-6">
        <form onSubmit={handleSubmit(save)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.appearance.title")}</CardTitle>
            <CardDescription>{t("settings.appearance.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller control={control} name="theme" render={({ field }) => (
              <div className="grid gap-3 sm:grid-cols-3">
                {CONFIGURATION_THEMES.map((option) => {
                  const Icon = option.value === "dark" ? Moon : option.value === "system" ? Monitor : Sun;
                  const selected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { field.onChange(option.value); setTheme(option.value); }}
                      className={cn(
                        "rounded-xl border p-4 text-left",
                        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-muted/10 hover:bg-muted/20",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("size-5", selected && "text-primary")} />
                        <div>
                          <p className="font-medium">{t(option.labelKey)}</p>
                          <p className="text-sm text-muted-foreground">{t(option.descriptionKey)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.language.title")}</CardTitle>
            <CardDescription>{t("settings.language.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="language"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>{t("shell.language.label")}</Label>
                  <SearchableSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={CONFIGURATION_LANGUAGES.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t("shell.language.selectPlaceholder")}
                    searchPlaceholder={t("shell.language.searchPlaceholder")}
                  />
                </div>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.tabs.title")}</CardTitle>
            <CardDescription>{t("settings.tabs.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>{t("settings.tabs.maxLabel")}</Label>
            <Controller
              control={control}
              name="maxWorkspaceTabs"
              render={({ field }) => (
                <Input
                  type="number"
                  min={MIN_MAX_WORKSPACE_TABS}
                  max={MAX_MAX_WORKSPACE_TABS}
                  value={field.value}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  aria-invalid={Boolean(errors.maxWorkspaceTabs)}
                />
              )}
            />
            {errors.maxWorkspaceTabs ? (
              <p className="text-sm text-destructive">{errors.maxWorkspaceTabs.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("settings.tabs.hint", { min: MIN_MAX_WORKSPACE_TABS, max: MAX_MAX_WORKSPACE_TABS })}
              </p>
            )}
          </CardContent>
        </Card>

        {updatePreferences.error ? (
          <p className="text-sm text-destructive">{normalizeApiError(updatePreferences.error).message}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={updatePreferences.isPending}
            onClick={() => {
              reset(preferencesQuery.data ?? DEFAULT_USER_PREFERENCES);
              setTheme(preferencesQuery.data?.theme ?? "system");
            }}
          >
            {t("settings.actions.reset")}
          </Button>
          <Button type="submit" disabled={updatePreferences.isPending}>
            {updatePreferences.isPending ? t("common.actions.saving") : t("settings.actions.save")}
          </Button>
        </div>
        </form>
      </div>
    </div>
  );
}
