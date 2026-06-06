"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONFIGURATION_LANGUAGES,
  CONFIGURATION_THEMES,
  configurationToFormValues,
  formValuesToConfiguration,
  type ThemePreference,
  type UserConfigurationFormValues,
} from "@/lib/configuration/types";
import { useConfigurationStore, useSaveConfiguration } from "@/lib/configuration/use-configuration";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function ConfigurationWorkspace() {
  const { notifySuccess } = useFeedback();
  const configuration = useConfigurationStore();
  const saveConfiguration = useSaveConfiguration();
  const { setTheme } = useTheme();
  const [values, setValues] = useState<UserConfigurationFormValues>(() =>
    configurationToFormValues(configuration)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setValues(configurationToFormValues(configuration));
  }, [configuration]);

  function updateField<K extends keyof UserConfigurationFormValues>(
    key: K,
    value: UserConfigurationFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);

    if (key === "theme") {
      setTheme(value as ThemePreference);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      const nextConfiguration = formValuesToConfiguration(values, configuration.password);
      saveConfiguration(nextConfiguration);
      setTheme(nextConfiguration.theme);
      setValues(configurationToFormValues(nextConfiguration));
      notifySuccess("Configuration saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save configuration.");
    }
  }

  function handleReset() {
    setValues(configurationToFormValues(configuration));
    setTheme(configuration.theme);
    setFormError(null);
  }

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Manage your appearance, account credentials, and language preference."
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how the dashboard looks on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONFIGURATION_THEMES.map((option) => {
                const Icon = option.value === "dark" ? Moon : Sun;
                const isSelected = values.theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField("theme", option.value)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-muted/10 hover:bg-muted/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {mounted ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Current theme: {values.theme === "dark" ? "Dark" : "Light"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Update your login username, password, and display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                value={values.username}
                onChange={(event) => updateField("username", event.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={values.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep your current password.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                value={values.displayName}
                onChange={(event) => updateField("displayName", event.target.value)}
                placeholder="Hector Mejia"
                autoComplete="name"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language preference</CardTitle>
            <CardDescription>Select the language used across the dashboard interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language">
                Language <span className="text-destructive">*</span>
              </Label>
              <select
                id="language"
                className={selectClassName}
                value={values.language}
                onChange={(event) =>
                  updateField("language", event.target.value as UserConfigurationFormValues["language"])
                }
                required
              >
                {CONFIGURATION_LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset changes
          </Button>
          <Button type="submit">Save configuration</Button>
        </div>
      </form>
    </div>
  );
}
