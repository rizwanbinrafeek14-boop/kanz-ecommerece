import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PRIVACY } from "@/lib/static-content";

export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "/privacy", title: getDictionary(l).static.privacy, description: l === "ar" ? "كيف تتعامل مؤسسة كنز كورنر مع البيانات الشخصية التي تُجمع عبر هذا الموقع." : "How KANZ CORNER EST. handles personal data collected through this website." });
}
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 border-s-4 border-primary ps-3 text-3xl font-bold">{dict.static.privacy}</h1>
      <div className="space-y-4 leading-relaxed text-muted-foreground">{PRIVACY[lang].map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
    </article>
  );
}
