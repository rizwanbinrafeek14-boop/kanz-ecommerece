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

/** "Repeat this RFQ": the signed-in customer's earlier request as editable lines. Product links are kept only while the
 *  product is still published (and the size still offered); otherwise the line stays as plain text for the sales team. */
async function repeatLines(sb: Awaited<ReturnType<typeof createClient>>, rfqId: string) {
  const { data: rfq } = await sb.from("rfqs").select("rfq_number, rfq_items(line_no, product_id, variant_id, description, specification, quantity, unit)").eq("id", rfqId).maybeSingle();   // RLS: own requests only
  if (!rfq?.rfq_items?.length) return null;
  const items = [...rfq.rfq_items].sort((a, b) => a.line_no - b.line_no);
  const pids = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  const vids = [...new Set(items.map((i) => i.variant_id).filter(Boolean))] as string[];
  const [{ data: ps }, { data: vs }] = await Promise.all([
    pids.length ? sb.from("products").select("id").in("id", pids).eq("status", "published") : Promise.resolve({ data: [] as { id: string }[] }),
    vids.length ? sb.from("product_variants").select("id").in("id", vids).eq("is_active", true) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const okP = new Set((ps ?? []).map((x) => x.id)); const okV = new Set((vs ?? []).map((x) => x.id));
  let unlisted = 0;
  const lines = items.map((i) => {
    const product = i.product_id && okP.has(i.product_id) ? i.product_id : undefined;
    if (i.product_id && !product) unlisted++;
    return { product_id: product, variant_id: product && i.variant_id && okV.has(i.variant_id) ? i.variant_id : undefined,
      description: i.description, specification: i.specification ?? "", quantity: String(Number(i.quantity)), unit: i.unit || "pcs" };
  });
  return { number: rfq.rfq_number as string, lines, unlisted };
}

export default async function RfqPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ repeat?: string }> }) {
  const { lang } = await params; const { repeat } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const user = await getSessionUser();
  let d = { name: "", email: "", phone: "", company: "", vat_number: "" };
  if (user) {
    const sb = await createClient();
    const { data: p } = await sb.from("profiles").select("full_name, phone, company_name, vat_number").eq("id", user.id).single();
    d = { name: p?.full_name ?? "", email: user.email ?? "", phone: p?.phone ?? "", company: p?.company_name ?? "", vat_number: p?.vat_number ?? "" };
  }
  const again = user && repeat && /^[0-9a-f-]{36}$/i.test(repeat) ? await repeatLines(await createClient(), repeat) : null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{dict.rfq.title}</h1>
      <p className="mb-6 mt-2 text-muted-foreground">{dict.rfq.intro}</p>
      <RfqForm lang={lang} dict={dict} defaults={d} repeat={again ?? undefined} />
    </div>
  );
}
