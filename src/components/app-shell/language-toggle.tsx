"use client";

import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateConfigurationLanguage } from "@/lib/configuration/store";
import { CONFIGURATION_LANGUAGES, type LanguagePreference } from "@/lib/configuration/types";
import { useConfigurationStore, useUpdateUserPreferences } from "@/lib/configuration/use-configuration";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { t } = useTranslation();
  const preferences = useConfigurationStore();
  const updatePreferences = useUpdateUserPreferences();
  const label = t("shell.language.change");

  function applyLanguage(nextLanguage: LanguagePreference) {
    if (nextLanguage === preferences.language) return;
    updateConfigurationLanguage(nextLanguage);
    updatePreferences.mutate({ ...preferences, language: nextLanguage });
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={label}>
              <Languages className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("shell.language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CONFIGURATION_LANGUAGES.map((option) => {
          const isActive = preferences.language === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => applyLanguage(option.value)}
              className="justify-between"
            >
              <span>{t(option.labelKey)}</span>
              <Check className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
