"use client";
import * as React from "react";
import { FileDown, FileText, Download, Lock, Info, Columns3, X } from "lucide-react";
import { BuyBox, MaterialChips, type BuyProps, type BuyVariant, type MatOpt } from "./product-buybox";
import { settle, type SelOption } from "./option-selector";
import { DimensionsPanel } from "./dimensions-panel";
import { ProductTabs } from "./product-tabs";
import { Gallery, type GalleryLabels } from "./gallery";
import { ApprovalsSection, type ApprovalLabels } from "./approvals";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import type { DimensionTableRow } from "@/lib/queries/catalog";
import type { Approval } from "@/lib/queries/certs";
import type { ConfigChoice } from "@/lib/types";

/** One manufacturer's offering on a family page. Everything here comes from that manufacturer's own product record; nothing is shared between brands. */
export interface Offer {
  id: string; slug: string; name: string; unit: string; quoteOnly: boolean; basePrice: number | null; minQty: number; cartImage: string | null;
  brand: { slug: string; name: string; logo: string | null };
  options: SelOption[]; variants: (BuyVariant & { weight: number | null; code: string | null })[]; optionLabels: Record<string, Record<string, string>>;
  tables: DimensionTableRow[]; tableDrawings: Record<string, string | null>; drawings: { url: string; alt: string }[];
  specRows: [string, string][]; standards: { code: string; scope: string }[]; materials: { type: string; grades: string[] }[]; notes: string[];
  documents: { id: string; title: string }[]; sourceNote: string | null; approvals: Approval[];
  /** Verified / auto-detected materials of this manufacturer's offering (with its exact grades). */
  shownMaterials: MatOpt[];
  choices?: ConfigChoice[];
}
type Common = Pick<BuyProps, "vatRate" | "whatsapp" | "waGreeting" | "lang" | "dict" | "url" | "approvalLabels">;

const T = {
  en: { brand: "Choose manufacturer / brand", sizes: "sizes", summary: "Selected configuration", code: "Manufacturer code", weight: "Weight", sku: "SKU", notListed: "not listed",
    changed: (b: string, items: string[]) => `${b} does not list the same choice: ${items.join("; ")}.`, cleared: (o: string, v: string, n: string) => `${o} ${v} → ${n}`, dropped: (o: string) => `${o} is not a choice for this brand`,
    specs: "Technical specifications", drawings: "Engineering drawings", dims: "Dimensional tables", downloads: "Downloads", materials: "Materials & standards", variants: "All configurations",
    noDrawings: "This manufacturer's catalogue has no dimension drawing for this product.", download: "Download drawing", datasheet: "Download manufacturer datasheet (PDF)", signIn: "Free account required - sign in to download",
    docs: "Manufacturer documents", compare: "Compare brands", compareHint: "Choose up to 3 manufacturers. Weight and dimensions are compared only for the configuration you selected above.",
    manufacturer: "Manufacturer", availSizes: "Available sizes", grades: "Material grades", classes: "Pressure class / schedule", connections: "Connection types", standards: "Applicable standards",
    cfgWeight: "Weight (selected configuration)", cfgDims: "Dimensions (selected configuration)", sheet: "Datasheet", yes: "Yes (sign-in required)", noData: "No data", notOffered: "Not offered in this configuration",
    noneListed: "Not listed in the catalogue", forProduct: "for this product", general: "mentioned generally in the catalogue", gradesNotListed: "grades not listed in the catalogue", notes: "Catalogue notes", close: "Close comparison",
    asPublished: "Drawing as published by the manufacturer (not a certified engineering drawing). Source: manufacturer catalogue.",
    noMaterial: (b: string) => `${b} does not list the chosen material`, notInMaterial: "Not listed in this material", matNotVerified: "Material not verified" },
  ar: { brand: "اختر الشركة المصنعة / العلامة", sizes: "مقاس", summary: "التكوين المحدد", code: "رمز المصنع", weight: "الوزن", sku: "رمز الصنف", notListed: "غير مذكور",
    changed: (b: string, items: string[]) => `لا يذكر ${b} نفس الاختيار: ${items.join("؛ ")}.`, cleared: (o: string, v: string, n: string) => `${o} ${v} ← ${n}`, dropped: (o: string) => `${o} ليس خياراً لهذه العلامة`,
    specs: "المواصفات الفنية", drawings: "الرسومات الهندسية", dims: "جداول الأبعاد", downloads: "التحميلات", materials: "المواد والمواصفات", variants: "جميع التكوينات",
    noDrawings: "لا يحتوي كتالوج هذه الشركة على رسم أبعاد لهذا المنتج.", download: "تحميل الرسم", datasheet: "تحميل ورقة بيانات الشركة المصنعة (PDF)", signIn: "يتطلب حساباً مجانياً - سجّل الدخول للتحميل",
    docs: "مستندات الشركة المصنعة", compare: "مقارنة العلامات", compareHint: "اختر حتى 3 شركات. تُقارن الأوزان والأبعاد للتكوين الذي اخترته أعلاه فقط.",
    manufacturer: "الشركة المصنعة", availSizes: "المقاسات المتاحة", grades: "درجات المواد", classes: "فئة الضغط / السماكة", connections: "أنواع التوصيل", standards: "المواصفات القياسية",
    cfgWeight: "الوزن (التكوين المحدد)", cfgDims: "الأبعاد (التكوين المحدد)", sheet: "ورقة البيانات", yes: "نعم (يتطلب تسجيل الدخول)", noData: "لا توجد بيانات", notOffered: "غير متوفر بهذا التكوين",
    noneListed: "غير مذكور في الكتالوج", forProduct: "لهذا المنتج", general: "مذكورة بشكل عام في الكتالوج", gradesNotListed: "الدرجات غير مذكورة في الكتالوج", notes: "ملاحظات الكتالوج", close: "إغلاق المقارنة",
    asPublished: "الرسم كما نشرته الشركة المصنعة (ليس رسماً هندسياً معتمداً). المصدر: كتالوج الشركة المصنعة.",
    noMaterial: (b: string) => `لا يذكر ${b} المادة المختارة`, notInMaterial: "غير متوفر بهذه المادة", matNotVerified: "المادة غير مؤكدة" },
};
const SIZE_KEYS = ["size", "run", "outlet", "large", "small"];
const CLASS_KEYS = ["class", "pressure_class", "rating", "schedule"];
const fits = (want: Record<string, string>, have: Record<string, string>) => Object.entries(want).every(([k, v]) => have[k] === v);
const optVars = (o: Offer) => o.variants.filter((v) => v.options && Object.keys(v.options).length).map((v) => ({ id: v.id, options: v.options! }));

/** Carry the previous selection to another brand: keep every value the new brand also offers, settle the rest, and say what changed. */
function carry(prev: Record<string, string>, from: Offer | undefined, to: Offer, lang: "en" | "ar") {
  const t = T[lang]; const vars = optVars(to);
  if (!to.options.length || !vars.length) return { sel: {}, notice: null as string | null };
  const start = { ...vars[0].options, ...Object.fromEntries(Object.entries(prev).filter(([k]) => to.options.some((o) => o.key === k))) };
  const sel = settle(to.options, vars, start);
  const items: string[] = [];
  for (const [k, v] of Object.entries(prev)) {
    const name = from?.options.find((o) => o.key === k)?.name ?? k; const oldLabel = from?.optionLabels[k]?.[v] ?? v;
    if (!to.options.some((o) => o.key === k)) items.push(t.dropped(name));
    else if (sel[k] !== v) items.push(t.cleared(name, oldLabel, to.optionLabels[k]?.[sel[k]] ?? sel[k]));
  }
  return { sel, notice: items.length ? t.changed(to.brand.name, items) : null };
}

export function FamilyView({ name, shortDesc, familyImage, offers, common, galleryLabels, approvalLabels }: {
  name: string; shortDesc: string | null; familyImage: string | null; offers: Offer[]; common: Common; galleryLabels: GalleryLabels; approvalLabels: ApprovalLabels;
}) {
  const lang = common.lang as "en" | "ar"; const t = T[lang];
  const [brand, setBrand] = React.useState(offers[0].brand.slug);
  const [initial, setInitial] = React.useState<Record<string, string> | undefined>(undefined);
  const [notice, setNotice] = React.useState<string | null>(null);
  const cur = React.useRef<{ sel: Record<string, string>; vid: string | null }>({ sel: {}, vid: null });
  const [state, setState] = React.useState<{ sel: Record<string, string>; vid: string | null }>({ sel: {}, vid: null });
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [compareSet, setCompareSet] = React.useState<string[]>(offers.slice(0, 3).map((o) => o.brand.slug));
  const offer = offers.find((o) => o.brand.slug === brand) ?? offers[0];
  // Material comes first: the union of what the manufacturers list; a brand without the chosen material cannot be selected
  const allMats = React.useMemo(() => { const m = new Map<string, MatOpt>(); for (const o of offers) for (const x of o.shownMaterials) if (!m.has(x.code)) m.set(x.code, x); return [...m.values()]; }, [offers]);
  const [material, setMaterialState] = React.useState<string | null>(null);
  const has = (o: Offer, code: string | null) => !code || o.shownMaterials.some((m) => m.code === code);

  const choose = React.useCallback((slug: string, quiet = false) => {
    const to = offers.find((o) => o.brand.slug === slug || o.slug === slug); if (!to || to.brand.slug === brand) return;
    const from = offers.find((o) => o.brand.slug === brand);
    const c = carry(cur.current.sel, from, to, lang);
    setInitial(c.sel); setNotice(quiet ? null : c.notice); setBrand(to.brand.slug);
    const u = new URL(window.location.href); u.searchParams.set("brand", to.brand.slug); window.history.replaceState(null, "", u);
  }, [offers, brand, lang]);
  const setMaterial = React.useCallback((code: string | null, quiet = false) => {
    setMaterialState(code);
    const u = new URL(window.location.href); if (code) u.searchParams.set("material", code); else u.searchParams.delete("material"); window.history.replaceState(null, "", u);
    // the current brand does not list it: move to the first one that does (selection carried over as usual)
    const cur = offers.find((o) => o.brand.slug === brand);
    if (code && cur && !has(cur, code)) { const to = offers.find((o) => has(o, code)); if (to) choose(to.brand.slug, quiet); }
  }, [offers, brand, choose]);
  // ?brand=… and ?material=… (shared links, filtered listings, redirected brand pages) are applied after the first paint
  const fromUrl = React.useCallback(() => {
    const q = new URLSearchParams(window.location.search); const b = q.get("brand"); const m = q.get("material")?.toUpperCase() ?? null;
    const okM = m && allMats.some((x) => x.code === m) ? m : null;
    const target = b ? offers.find((o) => o.brand.slug === b || o.slug === b) : undefined;
    if (okM) setMaterialState(okM);
    if (target && has(target, okM)) choose(target.brand.slug, true);
    else if (okM && !has(offers.find((o) => o.brand.slug === brand)!, okM)) { const to = offers.find((o) => has(o, okM)); if (to) choose(to.brand.slug, true); }
  }, [offers, allMats, brand, choose]);
  React.useEffect(() => { const t = setTimeout(fromUrl, 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSel = React.useCallback((sel: Record<string, string>, vid: string | null) => { cur.current = { sel, vid }; setState({ sel, vid }); }, []);
  const v = offer.variants.find((x) => x.id === state.vid);
  const summary = (
    <div className="rounded-lg border-2 border-primary/25 bg-primary/5 p-4" aria-live="polite">
      <p className="spec-label mb-1 text-steel-600">{t.summary}</p>
      <p className="font-semibold">{[offer.brand.name, material && allMats.find((m) => m.code === material)?.name, ...offer.options.map((o) => offer.optionLabels[o.key]?.[state.sel[o.key]]).filter(Boolean)].filter(Boolean).join(" · ")}</p>
      {v && <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div><dt className="text-steel-600">{t.sku}</dt><dd dir="ltr" className="font-mono">{v.sku}</dd></div>
        <div><dt className="text-steel-600">{t.code}</dt><dd dir="ltr" className="font-mono">{v.code ?? t.notListed}</dd></div>
        <div><dt className="text-steel-600">{t.weight}</dt><dd className="font-mono">{v.weight != null ? `${Number(v.weight).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} kg` : t.notListed}</dd></div>
      </dl>}
    </div>);

  const images = familyImage ? [{ url: familyImage, alt: name }] : offer.drawings;
  const tabs = [
    { id: "specs", label: t.specs, content: <SpecsPanel offer={offer} t={t} lang={lang} /> },
    { id: "drawings", label: t.drawings, content: offer.drawings.length ? (
      <div className="space-y-4">
        <div className="max-w-2xl"><Gallery key={offer.brand.slug} images={offer.drawings} alt={`${name} - ${offer.brand.name}`} labels={galleryLabels} /></div>
        <ul className="flex flex-wrap gap-2">{offer.drawings.map((d, i) => <li key={d.url}><a href={d.url} download target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm hover:border-primary hover:text-primary"><Download className="size-4" aria-hidden="true" />{t.download} {offer.drawings.length > 1 ? i + 1 : ""}</a></li>)}</ul>
        <p className="text-xs text-steel-500">{t.asPublished}</p>
      </div>) : <p className="text-sm text-muted-foreground">{t.noDrawings}</p> },
    ...(offer.tables.length ? [{ id: "dims", label: t.dims, content: <DimensionsPanel key={offer.brand.slug} tables={offer.tables} optionLabels={offer.optionLabels} drawings={offer.tableDrawings}
      variants={offer.variants.filter((x) => x.options && Object.keys(x.options).length).map((x) => ({ id: x.id, options: x.options!, label: [offer.brand.name, ...offer.options.map((o) => offer.optionLabels[o.key]?.[x.options![o.key]])].filter(Boolean).join(" · ") }))}
      labels={lang === "ar" ? { selected: "المحدد", none: "لا توجد أبعاد منشورة لهذا الاختيار.", showAll: "عرض جميع المقاسات ({n})", showFewer: "عرض المقاس المحدد فقط", source: `المصدر: كتالوج ${offer.brand.name}`, drawing: "رسم الأبعاد", asPublished: t.asPublished }
        : { selected: "Selected", none: "No dimensions are published for this selection.", showAll: "Show all sizes ({n})", showFewer: "Show the selected size only", source: `Source: ${offer.brand.name} catalogue`, drawing: "Dimensional drawing", asPublished: t.asPublished }} /> }] : []),
    { id: "downloads", label: t.downloads, content: (
      <div className="max-w-xl space-y-3">
        <a href={`/api/datasheet/${offer.slug}?lang=${lang}${v ? `&variant=${v.id}` : ""}`} target="_blank" rel="noopener noreferrer nofollow" onClick={() => track("datasheet_download", { product: offer.id })} className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium hover:border-primary hover:text-primary">
          <FileDown className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="flex-1">{t.datasheet} - {offer.brand.name}{v ? <span className="ms-2 font-mono text-xs text-muted-foreground">{v.sku}</span> : null}</span></a>
        {offer.documents.map((d) => <a key={d.id} href={`/api/document/${d.id}?lang=${lang}`} target="_blank" rel="noopener noreferrer nofollow" onClick={() => track("datasheet_download", { product: offer.id })} className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm font-medium hover:border-primary hover:text-primary"><FileText className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="flex-1">{d.title}</span><Download className="size-4" aria-hidden="true" /></a>)}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" aria-hidden="true" />{t.signIn}</p>
      </div>) },
  ];

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1fr_460px]">
        <Gallery key={familyImage ? "family" : offer.brand.slug} images={images} alt={name} labels={galleryLabels} />
        <div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{offers.map((o) => o.brand.name).join(" · ")}</p>
          {shortDesc && <p className="mt-4 text-muted-foreground">{shortDesc}</p>}

          {allMats.length > 0 && <div className="mt-5 rounded-xl border bg-card p-5">
            <MaterialChips materials={allMats} value={material} onChange={(c) => setMaterial(c)} lang={common.lang} />
          </div>}
          <fieldset className="mt-5 rounded-xl border bg-card p-5">
            <legend className="px-1 text-sm font-semibold">{t.brand}</legend>
            <div role="radiogroup" aria-label={t.brand} className="grid gap-2 sm:grid-cols-2">
              {offers.map((o) => {
                const on = o.brand.slug === offer.brand.slug; const n = new Set(o.variants.map((x) => SIZE_KEYS.map((k) => x.options?.[k]).filter(Boolean).join("x"))).size;
                const off = !has(o, material);
                return (
                  <button key={o.brand.slug} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => choose(o.brand.slug)} title={off ? t.noMaterial(o.brand.name) : undefined}
                    className={cn("flex min-h-14 items-center gap-3 rounded-lg border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45", on ? "border-ink bg-ink text-white" : "border-steel-300 bg-white hover:border-primary")}>
                    {o.brand.logo ? <img src={o.brand.logo} alt="" className="size-9 shrink-0 rounded bg-white object-contain p-0.5" /> : <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded font-mono text-xs font-bold", on ? "bg-white/15" : "bg-steel-100 text-steel-700")}>{o.brand.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase()}</span>}
                    <span className="min-w-0"><span className="block truncate font-semibold">{o.brand.name}</span><span className={cn("block text-xs", on ? "text-white/70" : "text-muted-foreground")}>{off ? t.notInMaterial : [n > 0 ? `${n} ${t.sizes}` : "", o.shownMaterials.map((m) => m.code).join(" | ") || t.matNotVerified].filter(Boolean).join(" · ")}</span></span>
                  </button>);
              })}
            </div>
            {notice && <p role="status" className="mt-3 flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{notice}</p>}
          </fieldset>

          <div className="mt-4">
            <BuyBox key={offer.brand.slug} {...common} approvalLabels={approvalLabels} approvals={offer.approvals} brandName={offer.brand.name}
              product={{ id: offer.id, slug: offer.slug, name: offer.name, unit: offer.unit, quoteOnly: offer.quoteOnly, basePrice: offer.basePrice, minQty: offer.minQty, image: offer.cartImage }}
              options={offer.options} variants={offer.variants} datasheet={`/api/datasheet/${offer.slug}`} initialSel={initial} onSelChange={onSel} afterOptions={summary}
              materials={offer.shownMaterials} material={material} materialControlled choices={offer.choices} />
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-12">
        <ProductTabs key={offer.brand.slug} tabs={tabs} />
        <ApprovalsSection approvals={offer.approvals} lang={common.lang} labels={approvalLabels} />
        {offers.length > 1 && (
          <section aria-labelledby="cmp-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="cmp-h" className="border-s-4 border-primary ps-3 text-xl font-bold">{t.compare}</h2>
              <button type="button" onClick={() => setCompareOpen((x) => !x)} aria-expanded={compareOpen} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-white">
                {compareOpen ? <X className="size-4" aria-hidden="true" /> : <Columns3 className="size-4" aria-hidden="true" />}{compareOpen ? t.close : t.compare}</button>
            </div>
            {compareOpen && <Compare offers={offers} chosen={compareSet} setChosen={setCompareSet} sel={state.sel} t={t} />}
          </section>)}
      </div>
    </>
  );
}

function SpecsPanel({ offer, t, lang }: { offer: Offer; t: (typeof T)["en"]; lang: "en" | "ar" }) {
  const showW = offer.variants.some((x) => x.weight != null); const showC = offer.variants.some((x) => x.code);
  return (
    <div className="space-y-8">
      {offer.specRows.length > 0 && <div className="overflow-hidden rounded-md border border-steel-200"><table className="w-full text-sm"><tbody>{offer.specRows.map(([k, v], i) => <tr key={i} className="border-b border-steel-100 last:border-0 odd:bg-steel-50/60"><th scope="row" className="w-1/3 p-3 text-start align-top font-semibold">{k}</th><td className="p-3">{v}</td></tr>)}</tbody></table></div>}
      {(offer.materials.length > 0 || offer.standards.length > 0 || offer.notes.length > 0) && <div className="grid gap-6 text-sm md:grid-cols-2">
        {offer.materials.length > 0 && <div><h3 className="mb-2 font-semibold">{lang === "ar" ? "المواد" : "Materials"}</h3><ul className="space-y-1">{offer.materials.map((m, i) => <li key={i}><span className="font-medium">{m.type}</span>{m.grades.length ? <span className="font-mono text-steel-700"> - {m.grades.join(", ")}</span> : <span className="text-steel-500"> - {t.gradesNotListed}</span>}</li>)}</ul></div>}
        {offer.standards.length > 0 && <div><h3 className="mb-2 font-semibold">{t.standards}</h3><ul className="space-y-1">{offer.standards.map((x, i) => <li key={i}><span className="font-mono">{x.code}</span> <span className="text-steel-500">- {x.scope === "product" ? t.forProduct : t.general}</span></li>)}</ul></div>}
        {offer.notes.length > 0 && <div className="md:col-span-2"><h3 className="mb-2 font-semibold">{t.notes}</h3><ul className="list-disc space-y-1 ps-5 text-steel-700">{offer.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
      </div>}
      {offer.variants.length > 0 && <details className="rounded-md border border-steel-200"><summary className="cursor-pointer p-3 text-sm font-semibold">{t.variants} ({offer.variants.length})</summary>
        <div className="max-h-[28rem] overflow-auto border-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label={t.variants}><table className="w-full text-sm">
          <thead className="sticky top-0 bg-steel-50 text-xs text-steel-700"><tr><th scope="col" className="p-2.5 text-start">{t.sku}</th>{offer.options.map((o) => <th key={o.key} scope="col" className="p-2.5 text-start">{o.name}</th>)}{showC && <th scope="col" className="p-2.5 text-start">{t.code}</th>}{showW && <th scope="col" className="p-2.5 text-end">{t.weight} (kg)</th>}</tr></thead>
          <tbody>{offer.variants.map((x) => <tr key={x.id} className="border-t border-steel-100"><td className="p-2.5 font-mono" dir="ltr">{x.sku}</td>{offer.options.map((o) => <td key={o.key} className="p-2.5 font-mono">{offer.optionLabels[o.key]?.[x.options?.[o.key] ?? ""] ?? "-"}</td>)}{showC && <td className="p-2.5 font-mono" dir="ltr">{x.code ?? "-"}</td>}{showW && <td className="p-2.5 text-end font-mono tabular-nums">{x.weight != null ? Number(x.weight).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "-"}</td>}</tr>)}</tbody>
        </table></div></details>}
      {offer.sourceNote && <p className="text-xs text-steel-500">{offer.sourceNote}</p>}
    </div>
  );
}

function Compare({ offers, chosen, setChosen, sel, t }: { offers: Offer[]; chosen: string[]; setChosen: (x: string[]) => void; sel: Record<string, string>; t: (typeof T)["en"] }) {
  const cols = offers.filter((o) => chosen.includes(o.brand.slug));
  const values = (o: Offer, keys: string[]) => { const os = o.options.filter((x) => keys.includes(x.key)); return os.length ? os.map((x) => x.values.map((v) => v.label).join(", ")).join(" / ") : null; };
  const sizes = (o: Offer) => { const os = o.options.filter((x) => SIZE_KEYS.includes(x.key)); if (!os.length) return null; const n = new Set(o.variants.map((v) => os.map((x) => v.options?.[x.key]).join("x"))).size; const first = os[0].values; return `${first[0]?.label} - ${first[first.length - 1]?.label} (${n})`; };
  // the configuration chosen above, matched only on the keys this brand actually uses; dimensions only from the exact matching row
  const cfg = (o: Offer) => { const keys = o.options.map((x) => x.key); if (!keys.every((k) => sel[k])) return null; return o.variants.find((v) => v.options && keys.every((k) => v.options![k] === sel[k])) ?? null; };
  const dims = (o: Offer) => { const v = cfg(o); if (!v?.options) return null; const out: string[] = [];
    for (const tb of o.tables) { if (!fits(tb.applies, v.options)) continue; const r = tb.rows.find((x) => fits(x.match, v.options!)); if (!r) continue;
      for (const c of tb.columns) if (r.values[c.key] != null && c.unit === "mm") out.push(`${c.symbol || c.key} ${r.values[c.key]}`); }
    return out.length ? out.join(" · ") + " mm" : null; };
  const rows: [string, (o: Offer) => React.ReactNode][] = [
    [t.availSizes, (o) => sizes(o) ?? <em className="text-steel-500">{t.noneListed}</em>],
    [t.grades, (o) => (o.materials.length ? o.materials.map((m) => m.grades.length ? `${m.type}: ${m.grades.join(", ")}` : m.type).join("; ") : <em className="text-steel-500">{t.noneListed}</em>)],
    [t.classes, (o) => values(o, CLASS_KEYS) ?? <em className="text-steel-500">{t.noneListed}</em>],
    [t.connections, (o) => values(o, ["connection"]) ?? <em className="text-steel-500">{t.noneListed}</em>],
    [t.standards, (o) => { const s = o.standards.filter((x) => x.scope === "product").map((x) => x.code); return s.length ? s.join(", ") : <em className="text-steel-500">{t.noneListed}</em>; }],
    [t.cfgWeight, (o) => { const v = cfg(o); return !v ? <em className="text-steel-500">{t.notOffered}</em> : v.weight != null ? `${Number(v.weight).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} kg` : <em className="text-steel-500">{t.noData}</em>; }],
    [t.cfgDims, (o) => { const v = cfg(o); return !v ? <em className="text-steel-500">{t.notOffered}</em> : dims(o) ?? <em className="text-steel-500">{t.noData}</em>; }],
    [t.sheet, (o) => `${t.yes}${o.documents.length ? ` + ${o.documents.length}` : ""}`],
  ];
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">{t.compareHint}</p>
      <div className="flex flex-wrap gap-2">{offers.map((o) => { const on = chosen.includes(o.brand.slug); const full = !on && chosen.length >= 3;
        return <label key={o.brand.slug} className={cn("inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm", on ? "border-ink" : "border-steel-300", full && "opacity-50")}>
          <input type="checkbox" checked={on} disabled={full} onChange={(e) => setChosen(e.target.checked ? [...chosen, o.brand.slug] : chosen.filter((x) => x !== o.brand.slug))} />{o.brand.name}</label>; })}</div>
      {cols.length > 0 && <div className="overflow-x-auto rounded-md border border-steel-200" tabIndex={0} role="region" aria-label={t.compare}><table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-steel-50"><tr><th scope="col" className="w-48 p-3 text-start text-xs text-steel-700">{t.manufacturer}</th>{cols.map((o) => <th key={o.brand.slug} scope="col" className="p-3 text-start font-semibold">{o.brand.name}</th>)}</tr></thead>
        <tbody>{rows.map(([k, f]) => <tr key={k} className="border-t border-steel-100 align-top"><th scope="row" className="p-3 text-start text-xs font-semibold text-steel-700">{k}</th>{cols.map((o) => <td key={o.brand.slug} className="p-3">{f(o)}</td>)}</tr>)}</tbody>
      </table></div>}
    </div>
  );
}
