import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ABOUT } from "@/lib/static-content";

export const revalidate = 3600;
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: getDictionary(isLocale(lang) ? lang : "en").static.aboutTitle, alternates: { languages: { en: "/en/about", ar: "/ar/about" } } };
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
