import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RfqForm } from "@/components/storefront/rfq-form";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "/rfq", title: getDictionary(l).rfq.title, description: l === "ar" ? "أرسل طلب عرض سعر إلى كنز كورنر للأنابيب والوصلات والفلنجات والمحابس، مع المقاسات والدرجات والكميات المطلوبة." : "Send a request for quotation to KANZ CORNER EST. for pipes, fittings, flanges and valves. Tell us the sizes, grades and quantities you need." });
}

export default async function RfqPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const user = await getSessionUser();
  let d = { name: "", email: "", phone: "", company: "", vat_number: "" };
  if (user) {
    const sb = await createClient();
    const { data: p } = await sb.from("profiles").select("full_name, phone, company_name, vat_number").eq("id", user.id).single();
    d = { name: p?.full_name ?? "", email: user.email ?? "", phone: p?.phone ?? "", company: p?.company_name ?? "", vat_number: p?.vat_number ?? "" };
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{dict.rfq.title}</h1>
      <p className="mb-6 mt-2 text-muted-foreground">{dict.rfq.intro}</p>
      <RfqForm lang={lang} dict={dict} defaults={d} />
    </div>
  );
}
