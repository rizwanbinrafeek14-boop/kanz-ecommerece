import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { SocialLinkRow } from "@/components/social-icon";

export interface ContactWidget {
  whatsapp_enabled: boolean; whatsapp_number: string; default_message_en: string; default_message_ar: string; icon_path: string | null; position: "left" | "right";
  show_desktop: boolean; show_mobile: boolean; label_en: string; label_ar: string; description_en: string; description_ar: string; menu_label_en: string; menu_label_ar: string; show_call: boolean; call_number: string;
}
export interface Certification { id: string; name_en: string; name_ar: string | null; issuer: string | null; reference_number: string | null; valid_until: string | null; document_path: string | null }

/** Contact widget + active social links, cached per request. Degrades to "nothing shown" if Supabase (or migration 0010) is missing. */
export const getContact = cache(async (): Promise<{ widget: ContactWidget | null; links: SocialLinkRow[] }> => {
  const sb = createPublicClient(); if (!sb) return { widget: null, links: [] };
  try {
    const [w, l] = await Promise.all([sb.from("contact_widget").select("*").eq("id", 1).maybeSingle(), sb.from("social_links").select("*").eq("is_active", true).order("sort_order")]);
    return { widget: (w.data as ContactWidget | null) ?? null, links: (l.data ?? []) as SocialLinkRow[] };
  } catch { return { widget: null, links: [] }; }
});

export async function getProductCertifications(productId: string): Promise<Certification[]> {
  const sb = createPublicClient(); if (!sb) return [];
  try {
    const { data } = await sb.from("product_certifications").select("certifications(id, name_en, name_ar, issuer, reference_number, valid_until, document_path, sort_order)").eq("product_id", productId);
    const rows = (data ?? []).map((r: { certifications: unknown }) => (Array.isArray(r.certifications) ? r.certifications[0] : r.certifications) as (Certification & { sort_order: number }) | null).filter(Boolean) as (Certification & { sort_order: number })[];
    return rows.sort((a, b) => a.sort_order - b.sort_order);
  } catch { return []; }
}

/** WhatsApp number (digits, international) used for product enquiries: the admin widget if enabled, otherwise the legacy company setting. */
export function whatsappNumber(widget: ContactWidget | null, legacy: string): string {
  return widget ? (widget.whatsapp_enabled ? widget.whatsapp_number : "") : legacy.replace(/\D/g, "");
}
