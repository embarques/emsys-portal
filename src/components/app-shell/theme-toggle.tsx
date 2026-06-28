"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button";
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
import type { ThemePreference } from "@/lib/configuration/types";

const THEME_OPTIONS: { value: ThemePreference | "system"; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  function applyTheme(theme: ThemePreference | "system") {
    setTheme(theme);

    if (theme === "light" || theme === "dark") {
      updateConfigurationTheme(theme);
    }
  }

  const Icon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Change theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          const isActive = mounted && theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => applyTheme(option.value)}
              className="justify-between"
            >
              <span className="flex items-center">
                <OptionIcon className="mr-2 h-4 w-4" /> {option.label}
              </span>
              <Check className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
