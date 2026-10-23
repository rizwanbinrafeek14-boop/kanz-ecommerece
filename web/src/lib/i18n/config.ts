export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");

/** Pick the Arabic value when viewing in Arabic, falling back to English if the Arabic field is empty. */
export function loc(row: object | null | undefined, field: string, lang: Locale): string {
  if (!row) return "";
  const r = row as Record<string, unknown>;
  const en = (r[`${field}_en`] ?? r[field]) as string | null | undefined;
  const ar = r[`${field}_ar`] as string | null | undefined;
  return (lang === "ar" ? ar || en : en) ?? "";
}
