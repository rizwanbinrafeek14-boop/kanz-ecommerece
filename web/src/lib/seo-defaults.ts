/** Default SEO text generated from real catalogue data. Used by the storefront metadata AND the admin preview, so what staff see is what is generated. */
import type { Locale } from "@/lib/i18n/config";

const SUFFIX = "KANZ CORNER EST.";
export const TITLE_SUFFIX = ` | ${SUFFIX}`;
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const uniq = (a: (string | null | undefined)[]) => [...new Set(a.map((x) => x?.trim()).filter((x): x is string => !!x))];

export interface SeoProductInput { name: string; sku?: string | null; shortDesc?: string | null; brand?: string | null; category?: string | null; sizes?: (string | null)[]; grades?: (string | null)[]; standards?: string[]; quoteOnly?: boolean }

export function defaultProductTitle(p: SeoProductInput, lang: Locale): string {
  const extra = p.sku ? ` (${p.sku})` : "";
  void lang;
  return clip(`${p.name}${extra}`, 52);
}
export function defaultProductDescription(p: SeoProductInput, lang: Locale): string {
  if (p.shortDesc && p.shortDesc.trim().length >= 40) return clip(p.shortDesc.trim(), 158);
  const sizes = uniq(p.sizes ?? []).slice(0, 6); const grades = uniq(p.grades ?? []).slice(0, 3); const stds = uniq(p.standards ?? []).slice(0, 3);
  if (lang === "ar") {
    const bits = [sizes.length ? `المقاسات: ${sizes.join("، ")}` : "", grades.length ? `الدرجات: ${grades.join("، ")}` : "", stds.length ? `المواصفات: ${stds.join("، ")}` : ""].filter(Boolean).join(" — ");
    return clip(`${p.name}${p.brand ? ` من ${p.brand}` : ""}${bits ? ` — ${bits}` : ""}. اطلب عرض سعر من كنز كورنر في الخبر.`, 158);
  }
  const bits = [sizes.length ? `Sizes: ${sizes.join(", ")}` : "", grades.length ? `Grades: ${grades.join(", ")}` : "", stds.length ? `Standards: ${stds.join(", ")}` : ""].filter(Boolean).join(" · ");
  return clip(`${p.name}${p.brand ? ` by ${p.brand}` : ""}${bits ? ` — ${bits}` : ""}. Request a quotation from KANZ CORNER EST., Al Khobar.`, 158);
}
export function defaultCategoryTitle(name: string, lang: Locale) { return lang === "ar" ? `${name} — اطلب عرض سعر` : `${name} — request a quotation`; }
export function defaultCategoryDescription(name: string, description: string | null | undefined, lang: Locale) {
  if (description && description.trim().length >= 40) return clip(description.trim(), 158);
  return lang === "ar" ? clip(`تصفح ${name} لدى كنز كورنر في الخبر. المواصفات والمقاسات المتاحة وعرض السعر عند الطلب.`, 158) : clip(`Browse ${name} from KANZ CORNER EST., Al Khobar. Specifications, sizes and quotation on request.`, 158);
}
export const SEO_LIMITS = { title: 60, description: 160 };
