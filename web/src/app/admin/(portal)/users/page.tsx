import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { UserManager } from "@/components/admin/user-manager";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Staff & roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const me = await requireAdmin(); const sp = await searchParams; const sb = await createClient();
  let q = sb.from("profiles").select("id, full_name, company_name, role, is_active, created_at").order("role").order("created_at", { ascending: false }).limit(200);
  if (!sp.all) q = q.in("role", ["staff", "admin"]);
  if (sp.q) { const t = sp.q.replace(/[%,()*\\]/g, " ").trim().slice(0, 80); if (t) q = q.or(`full_name.ilike.%${t}%,company_name.ilike.%${t}%`); }
  const { data } = await q;
  return (<><PageHeader title="Staff & roles" description="Only administrators can see this page. New sign-ups are always customers; promote someone here." />
    <form className="mb-4 flex flex-wrap gap-2"><Input name="q" defaultValue={sp.q} placeholder="Search name…" className="max-w-xs" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={!!sp.all} className="accent-[var(--primary)]" />Include customers</label><Button variant="secondary">Search</Button></form>
    <UserManager rows={(data ?? []).map((u) => ({ ...u, isMe: u.id === me.id }))} /></>);
}
