import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings, s } from "@/lib/settings";
import { getQualityCerts, type QualityCert } from "@/lib/queries/certs";
import { publicUrl } from "@/lib/format";

export const revalidate = 60;

const T = {
  en: {
    title: "Quality & Certifications", qa: "Quality Assurance", awards: "Awards & Certifications", view: "View Certificate", opens: "opens in a new tab", number: "Certificate no.", issuer: "Issued by", holder: "Holder", valid: "Valid until",
    banner: "Documented approvals. Clear quality records.", empty: "Certification information is being updated. Please contact us for the documents relevant to your order.",
    introDefault: "KANZ CORNER EST. supplies industrial pipes, fittings, flanges and valves from Al Khobar to customers across Saudi Arabia. We are a supplier and trader, and we do not manufacture the products we sell.\n\nQuality documents such as material test certificates and manufacturer approvals come from the manufacturers. We publish a certification here, or on a product page, only when we hold the supporting document, and the product page states exactly which products or sizes it covers.\n\nTell us the product, size and standard you need and we will confirm which documents are available for your order.",
    ctaText: "Need a certificate for a specific product?", cta1: "Request a quote", cta2: "Contact us",
  },
  ar: {
    title: "الجودة والشهادات", qa: "ضمان الجودة", awards: "الجوائز والشهادات", view: "عرض الشهادة", opens: "تفتح في نافذة جديدة", number: "رقم الشهادة", issuer: "الجهة المانحة", holder: "حامل الشهادة", valid: "سارية حتى",
    banner: "اعتمادات موثقة. سجلات جودة واضحة.", empty: "يجري تحديث معلومات الشهادات. يرجى التواصل معنا للحصول على المستندات المتعلقة بطلبك.",
    introDefault: "تورّد مؤسسة كنز كورنر المواسير والوصلات والفلنجات والصمامات الصناعية من الخبر إلى العملاء في أنحاء المملكة. نحن مورّد وتاجر ولا نقوم بتصنيع المنتجات التي نبيعها.\n\nتصدر وثائق الجودة، مثل شهادات اختبار المواد واعتمادات المصنّعين، عن المصنّعين. ولا ننشر شهادة هنا أو في صفحة المنتج إلا عندما يتوفر لدينا المستند الداعم، وتوضح صفحة المنتج بدقة المنتجات أو المقاسات التي تشملها.\n\nأخبرنا بالمنتج والمقاس والمواصفة المطلوبة وسنؤكد لك المستندات المتوفرة لطلبك.",
    ctaText: "هل تحتاج شهادة لمنتج معيّن؟", cta1: "اطلب عرض سعر", cta2: "اتصل بنا",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params; if (!isLocale(lang)) return {};
  return { title: T[lang].title, alternates: { canonical: `/${lang}/quality`, languages: { en: "/en/quality", ar: "/ar/quality" } } };
}

const linkOf = (c: QualityCert) => (c.document_path ? publicUrl("product-docs", c.document_path) : c.verification_url);
const nameOf = (c: QualityCert, lang: string) => (lang === "ar" && c.name_ar ? c.name_ar : c.name_en);

export default async function QualityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = T[lang]; const dict = getDictionary(lang);
  const [settings, certs] = await Promise.all([getSettings(), getQualityCerts()]);
  const intro = (s(settings, `quality_intro_${lang}`) || t.introDefault).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const banner = s(settings, `quality_banner_${lang}`) || t.banner;
  const withLogo = certs.filter((c) => c.logo_path);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:pt-14">
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{t.title}</h1>

        <section className="mt-10 max-w-4xl" aria-labelledby="qa-h">
          <h2 id="qa-h" className="text-2xl font-bold text-primary">{t.qa}</h2>
          <div className="mt-4 space-y-4 leading-relaxed">{intro.map((p, i) => <p key={i}>{p}</p>)}</div>
        </section>

        <section className="mt-16" aria-labelledby="aw-h">
          <h2 id="aw-h" className="text-2xl font-bold text-primary">{t.awards}</h2>
          {!certs.length ? <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t.empty}</p> : (
            <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-12">
              {certs.map((c) => { const href = linkOf(c); const name = nameOf(c, lang); const desc = lang === "ar" && c.description_ar ? c.description_ar : c.description_en; return (
                <li key={c.id} className="flex w-full flex-col items-center text-center sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]">
                  <div className="flex h-36 w-full max-w-[16rem] items-center justify-center">
                    {c.logo_path ? <img src={publicUrl("site-icons", c.logo_path)!} alt={name} loading="lazy" className="max-h-full max-w-full object-contain" /> : <span className="flex items-center gap-2 text-lg font-bold"><BadgeCheck className="size-6 text-primary" aria-hidden="true" />{name}</span>}
                  </div>
                  <h3 className="mt-3 font-semibold">{name}</h3>
                  <dl className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {c.issuer && <div><dt className="inline">{t.issuer}: </dt><dd className="inline">{c.issuer}</dd></div>}
                    {c.holder && <div><dt className="inline">{t.holder}: </dt><dd className="inline">{c.holder}</dd></div>}
                    {c.reference_number && <div><dt className="inline">{t.number}: </dt><dd className="inline" dir="ltr">{c.reference_number}</dd></div>}
                    {c.valid_until && <div><dt className="inline">{t.valid}: </dt><dd className="inline" dir="ltr">{c.valid_until}</dd></div>}
                  </dl>
                  {desc && <p className="mt-2 max-w-xs text-sm text-muted-foreground">{desc}</p>}
                  {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 min-w-32 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold uppercase tracking-wide text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {t.view}<span className="sr-only"> — {name} ({t.opens})</span></a>}
                </li>); })}
            </ul>)}
        </section>
      </div>

      {withLogo.length > 0 && (
        <section aria-labelledby="bn-h" className="relative isolate overflow-hidden bg-[#0b1650] py-14 text-white sm:py-16">
          <svg aria-hidden="true" focusable="false" className="absolute inset-0 -z-10 size-full" viewBox="0 0 1440 400" preserveAspectRatio="none">
            <path d="M0 260 C 240 160 420 340 720 250 S 1200 150 1440 250 V400 H0Z" fill="#ffffff" fillOpacity="0.045" />
            <path d="M0 330 C 300 250 520 380 800 310 S 1250 230 1440 320 V400 H0Z" fill="#ffffff" fillOpacity="0.05" />
            <path d="M0 60 C 260 140 560 -20 860 70 S 1240 130 1440 40 V0 H0Z" fill="#ffffff" fillOpacity="0.035" />
          </svg>
          <div className="mx-auto max-w-7xl px-4">
            <h2 id="bn-h" className="mx-auto max-w-3xl text-center text-2xl font-bold tracking-tight sm:text-4xl">{banner}</h2>
            <ul className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-center gap-3 sm:gap-4">
              {withLogo.map((c) => { const href = linkOf(c); const name = nameOf(c, lang);
                const img = <img src={publicUrl("site-icons", c.logo_path)!} alt={href ? "" : name} loading="lazy" className="max-h-full max-w-full object-contain" />;
                const cls = "flex aspect-[4/3] w-full items-center justify-center rounded-md bg-white p-4 shadow-sm";
                return <li key={c.id} className="w-[calc(50%-0.375rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(16.666%-0.834rem)]">{href
                  ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name} — ${t.view} (${t.opens})`} className={`${cls} transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1650]`}>{img}</a>
                  : <div className={cls}>{img}</div>}</li>; })}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <p className="font-medium">{t.ctaText}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/rfq`} className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t.cta1}</Link>
          <Link href={`/${lang}/contact`} className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{t.cta2}</Link>
        </div>
        <p className="sr-only">{dict.brand.name}</p>
      </div>
    </div>
  );
}
