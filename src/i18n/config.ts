export const locales = ["en", "fr", "es", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "bloom_locale";

export const localeMeta: Record<Locale, { label: string; native: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", native: "English", dir: "ltr" },
  fr: { label: "French", native: "Français", dir: "ltr" },
  es: { label: "Spanish", native: "Español", dir: "ltr" },
  ar: { label: "Arabic", native: "العربية", dir: "rtl" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
