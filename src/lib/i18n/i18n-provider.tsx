"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import { useConfigurationStore } from "@/lib/configuration/use-configuration";

import { translate, type Locale } from "./catalog";

type TranslateParams = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  t: (key: string, params?: TranslateParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { language } = useConfigurationStore();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale: language,
      t: (key, params) => translate(language, key, params),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return context;
}
