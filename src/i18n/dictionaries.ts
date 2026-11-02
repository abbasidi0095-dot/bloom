import en from "./en.json";
import fr from "./fr.json";
import es from "./es.json";
import ar from "./ar.json";
import { defaultLocale, type Locale } from "./config";

export type Dictionary = Record<string, string>;

export const dictionaries: Record<Locale, Dictionary> = {
  en: en as Dictionary,
  fr: fr as Dictionary,
  es: es as Dictionary,
  ar: ar as Dictionary,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function translate(
  dictionary: Dictionary,
  key: string,
  values?: Record<string, string | number>,
) {
  const template = dictionary[key] ?? dictionaries.en[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    values[name] === undefined ? `{${name}}` : String(values[name]),
  );
}
