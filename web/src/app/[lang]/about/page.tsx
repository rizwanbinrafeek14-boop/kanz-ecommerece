import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ABOUT } from "@/lib/static-content";

export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; const l = isLocale(lang) ? lang : "en";
  return pageMetadata({ lang: l, path: "/about", title: getDictionary(l).static.aboutTitle, description: l === "ar" ? "مؤسسة كنز كورنر مورّد صناعي للأنابيب والوصلات والفلنجات والمحابس (الصمامات) ومقرها الخبر في المملكة العربية السعودية." : "KANZ CORNER EST. is an industrial supplier of pipes, pipe fittings, flanges and valves based in Al Khobar, Saudi Arabia." });
}
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 border-s-4 border-primary ps-3 text-3xl font-bold">{dict.static.aboutTitle}</h1>
      <div className="space-y-4 leading-relaxed text-muted-foreground">{ABOUT[lang].map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
    </article>
  );
}
