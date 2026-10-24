import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { publicUrl } from "@/lib/format";

export interface QualityCert {
  id: string; name_en: string; name_ar: string | null; description_en: string | null; description_ar: string | null; issuer: string | null; reference_number: string | null; holder: string | null;
  logo_path: string | null; document_path: string | null; verification_url: string | null; valid_until: string | null; issued_at: string | null; sort_order: number;
}
/** What a product page needs for one approval (already filtered to published + unexpired + verified). */
export interface Approval {
  id: string; name_en: string; name_ar: string | null; logo: string | null; issuer: string | null; number: string | null; href: string | null; scopeNote: string | null; variantIds: string[]; validUntil: string | null;
}
const today = () => new Date().toISOString().slice(0, 10);
const live = (c: { is_active: boolean; valid_until: string | null; issued_at: string | null }) => c.is_active && (!c.valid_until || c.valid_until >= today()) && (!c.issued_at || c.issued_at <= today());

/** Certifications shown on /quality: published, not expired, "show on Quality page" on. (RLS enforces the same rules in the database.) */
export async function getQualityCerts(): Promise<QualityCert[]> {
  const sb = createPublicClient(); if (!sb) return [];
  try {
    const { data } = await sb.from("certifications").select("*").eq("show_on_quality", true).eq("is_active", true).order("sort_order").order("name_en");
    return ((data ?? []) as (QualityCert & { is_active: boolean })[]).filter(live);
  } catch { return []; }
}

/** Verified, live approvals for a product. Pending / not available / not applicable assignments and unpublished or expired certifications never leave this function. */
export async function getProductApprovals(productId: string): Promise<Approval[]> {
  const sb = createPublicClient(); if (!sb) return [];
  try {
    const { data } = await sb.from("product_certifications")
      .select("reference_number, document_path, verification_url, scope_note, variant_ids, status, certifications(id, name_en, name_ar, issuer, reference_number, logo_path, document_path, verification_url, valid_until, issued_at, is_active, sort_order)")
      .eq("product_id", productId).eq("status", "verified");
    type C = { id: string; name_en: string; name_ar: string | null; issuer: string | null; reference_number: string | null; logo_path: string | null; document_path: string | null; verification_url: string | null; valid_until: string | null; issued_at: string | null; is_active: boolean; sort_order: number };
    const rows = (data ?? []).map((r) => ({ r, c: (Array.isArray(r.certifications) ? r.certifications[0] : r.certifications) as C | null })).filter((x): x is { r: typeof x.r; c: C } => !!x.c && live(x.c));
    rows.sort((a, b) => a.c.sort_order - b.c.sort_order);
    return rows.map(({ r, c }) => ({
      id: c.id, name_en: c.name_en, name_ar: c.name_ar, logo: publicUrl("site-icons", c.logo_path), issuer: c.issuer, number: r.reference_number ?? c.reference_number,
      // Evidence attached to this product comes first; the certificate's own document/link is the fallback.
      href: r.document_path ? publicUrl("product-docs", r.document_path) : r.verification_url ?? (c.document_path ? publicUrl("product-docs", c.document_path) : c.verification_url),
      scopeNote: r.scope_note, variantIds: (r.variant_ids ?? []) as string[], validUntil: c.valid_until,
    }));
  } catch { return []; }
}
