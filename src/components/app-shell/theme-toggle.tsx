"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateConfigurationTheme } from "@/lib/configuration/store";
import { useConfigurationStore, useUpdateUserPreferences } from "@/lib/configuration/use-configuration";
import type { ThemePreference } from "@/lib/configuration/types";

const THEME_OPTION_KEYS: { value: ThemePreference | "system"; labelKey: string; icon: typeof Sun }[] = [
  { value: "light", labelKey: "shell.theme.light", icon: Sun },
  { value: "dark", labelKey: "shell.theme.dark", icon: Moon },
  { value: "system", labelKey: "shell.theme.system", icon: Laptop },
];

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const preferences = useConfigurationStore();
  const updatePreferences = useUpdateUserPreferences();

  React.useEffect(() => setMounted(true), []);

  function applyTheme(nextTheme: ThemePreference | "system") {
    setTheme(nextTheme);
    updateConfigurationTheme(nextTheme);
    updatePreferences.mutate({ ...preferences, theme: nextTheme });
  }

  const Icon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={t("shell.theme.change")}>
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("shell.theme.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTION_KEYS.map((option) => {
          const OptionIcon = option.icon;
          const isActive = mounted && theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => applyTheme(option.value)}
              className="justify-between"
            >
              <span className="flex items-center">
                <OptionIcon className="mr-2 h-4 w-4" /> {t(option.labelKey)}
              </span>
              <Check className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
