import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { SettingsMap } from "@/lib/types";

export const FALLBACK_SETTINGS: SettingsMap = {
  "public.vat_rate": 15,
  "public.currency": "SAR",
  "public.company_name_en": "KANZ CORNER EST.",
  "public.company_name_ar": "مؤسسة كنز كورنر",
  "public.company_phone": "+966 50 726 4938",
  "public.company_whatsapp": "966507264938",
  "public.company_email_sales": "sales@kanzcorner.com",
  "public.company_address_en": "B/W Prince Saad / Prince Talal Bin Abdulaziz Street, Cross 4, Al-Khobar, Saudi Arabia",
};

/** Public site settings (company info, VAT, SEO defaults). Cached per request. */
export const getSettings = cache(async (): Promise<SettingsMap> => {
  const sb = createPublicClient();
  if (!sb) return FALLBACK_SETTINGS;
  const { data, error } = await sb.from("site_settings").select("key, value");
  if (error || !data?.length) return FALLBACK_SETTINGS;
  return { ...FALLBACK_SETTINGS, ...Object.fromEntries(data.map((r) => [r.key, r.value])) };
});

export const s = (m: SettingsMap, key: string, fallback = ""): string => {
  const v = m[`public.${key}`] ?? m[key];
  return v === undefined || v === null ? fallback : String(v);
};
export const vatRateOf = (m: SettingsMap) => Number(m["public.vat_rate"] ?? 15);
