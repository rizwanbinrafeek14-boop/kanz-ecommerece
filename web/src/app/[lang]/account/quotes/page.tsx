import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatSAR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "My quotations", robots: { index: false } };

export default async function QuotesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const user = await requireCustomer(lang);
  const dict = getDictionary(lang);
  const sb = await createClient();
  const { data: rfqs } = await sb.from("rfqs").select("id, rfq_number, status, quoted_total, created_at, access_token").eq("user_id", user.id).order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">{dict.nav.myQuotes}</h1>
      {!rfqs?.length ? <p className="text-muted-foreground">{dict.account.noQuotes}</p> : (
        <ul className="divide-y rounded-xl border">
          {rfqs.map((r) => (
            <li key={r.id}><Link href={`/${lang}/rfq/view/${r.access_token}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40">
              <div><p className="font-mono font-semibold" dir="ltr">{r.rfq_number}</p><p className="text-sm text-muted-foreground">{formatDate(r.created_at, lang)}</p></div>
              <Badge variant={r.status === "quoted" ? "info" : "secondary"}>{dict.status[r.status as keyof typeof dict.status]}</Badge>
              <p className="font-semibold">{r.quoted_total != null ? formatSAR(r.quoted_total, lang) : "—"}</p>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
