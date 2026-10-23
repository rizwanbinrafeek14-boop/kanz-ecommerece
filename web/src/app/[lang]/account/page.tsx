import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "../actions";
import { ProfileForm } from "@/components/storefront/profile-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireCustomer(lang);
  const dict = getDictionary(lang);
  const sb = await createClient();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{dict.nav.account}</h1>
        <div className="flex gap-2">
          {(user.role === "staff" || user.role === "admin") && <Button asChild variant="dark" size="sm"><Link href="/admin">Admin portal</Link></Button>}
          <form action={signOutAction}><input type="hidden" name="lang" value={lang} /><Button variant="outline" size="sm">{dict.nav.signOut}</Button></form>
        </div>
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/${lang}/account/orders`} className="rounded-xl border p-5 font-semibold hover:border-primary">{dict.nav.myOrders} →</Link>
        <Link href={`/${lang}/account/quotes`} className="rounded-xl border p-5 font-semibold hover:border-primary">{dict.nav.myQuotes} →</Link>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <p className="mb-4 text-sm text-muted-foreground">{user.email}</p>
        <ProfileForm dict={dict} profile={profile} />
      </div>
    </div>
  );
}
