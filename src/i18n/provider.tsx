"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultLocale, localeMeta, type Locale } from "./config";
import { dictionaries, translate, type Dictionary } from "./dictionaries";

type I18nValue = {
  locale: Locale;
  dict: Dictionary;
  dir: "ltr" | "rtl";
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: defaultLocale,
  dict: dictionaries.en,
  dir: "ltr",
  t: (key, values) => translate(dictionaries.en, key, values),
});

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dict,
      dir: localeMeta[locale].dir,
      t: (key, values) => translate(dict, key, values),
    }),
    [locale, dict],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
