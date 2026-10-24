import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { CertificationManager, type CertRow } from "@/components/admin/certification-manager";

export const metadata = { title: "Certifications" };

export default async function CertificationsPage() {
  const user = await requireStaff(); const sb = await createClient();
  const { data } = await sb.from("certifications").select("*").order("sort_order").order("name_en");
  return (<><PageHeader title="Certifications" description="Real certifications held by the company, shown as badges on the products you attach them to. Nothing is invented: if this list is empty, no certification appears on the website." />
    <CertificationManager rows={(data ?? []) as CertRow[]} isAdmin={user.role === "admin"} /></>);
}
