import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { CertificationManager, type CertRow } from "@/components/admin/certification-manager";

export const metadata = { title: "Certifications" };

export default async function CertificationsPage() {
  await requireAdmin(); const sb = await createClient();
  const [{ data }, { data: asg }, { data: st }] = await Promise.all([
    sb.from("certifications").select("*").order("sort_order").order("name_en"),
    sb.from("product_certifications").select("certification_id"),
    sb.from("site_settings").select("key, value").like("key", "public.quality_%"),
  ]);
  const count = new Map<string, number>(); (asg ?? []).forEach((a) => count.set(a.certification_id, (count.get(a.certification_id) ?? 0) + 1));
  const g = (k: string) => String((st ?? []).find((r) => r.key === `public.quality_${k}`)?.value ?? "");
  return (<><PageHeader title="Certifications" description="Real certificates and approvals, shown on the Quality & Certifications page and, once assigned and verified, on product pages. Only administrators can manage them." />
    <CertificationManager rows={(data ?? []).map((c) => ({ ...c, assigned: count.get(c.id) ?? 0 })) as CertRow[]} text={{ intro_en: g("intro_en"), intro_ar: g("intro_ar"), banner_en: g("banner_en"), banner_ar: g("banner_ar") }} /></>);
}
