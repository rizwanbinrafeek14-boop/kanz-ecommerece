"use client";
import * as React from "react";
import { ProductPlaceholder } from "@/components/storefront/product-placeholder";
import { placeholderKind } from "@/lib/images/placeholder";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Folder, Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { publicUrl } from "@/lib/format";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

type Tab = "product" | "size" | "standard" | "material";
export interface FacetOption { value: string; label: string; n: number }
export interface HeroSearchProps {
  lang: "en" | "ar";
  categories: { slug: string; name: string }[];
  facets: Partial<Record<Exclude<Tab, "product">, FacetOption[]>>;
  t: { findBy: string; tabProduct: string; tabSize: string; tabStandard: string; tabMaterial: string; category: string; anyCategory: string; choose: string; go: string; unavailable: string; placeholder: string; suggestions: string; viewAll: string; categoryWord: string };
}
interface Sugg { kind: "product" | "family" | "category"; id: string; slug: string; name_en: string; name_ar: string | null; image_path: string | null }
const FACET_KEY: Record<Exclude<Tab, "product">, string> = { size: "size", standard: "standard", material: "material" };

/** Title-block styled advanced search: tabs for Product (with live suggestions), Size, Standard and Material, each optionally limited to a category. */
export function HeroSearch({ lang, categories, facets, t }: HeroSearchProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("product");
  const [q, setQ] = React.useState(""); const [cat, setCat] = React.useState(""); const [val, setVal] = React.useState("");
  const [sugg, setSugg] = React.useState<Sugg[]>([]); const [open, setOpen] = React.useState(false); const [busy, setBusy] = React.useState(false); const [active, setActive] = React.useState(-1);
  const box = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const tabs: { k: Tab; label: string }[] = [{ k: "product", label: t.tabProduct }, { k: "size", label: t.tabSize }, { k: "standard", label: t.tabStandard }, { k: "material", label: t.tabMaterial }];
  const list = q.trim().length >= 2 ? sugg : [];

  React.useEffect(() => {
    if (q.trim().length < 2 || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const h = setTimeout(async () => {
      setBusy(true);
      const { data } = await createClient().rpc("search_suggestions", { p_q: q.trim(), p_limit: 6 });
      setSugg((data as Sugg[]) ?? []); setBusy(false); setOpen(true); setActive(-1);
    }, 200);
    return () => clearTimeout(h);
  }, [q]);
  React.useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);

  const base = cat ? `/${lang}/category/${cat}` : `/${lang}/products`;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "product") {
      if (active >= 0 && list[active]) { const s = list[active]; router.push(s.kind !== "category" ? `/${lang}/product/${s.slug}` : `/${lang}/category/${s.slug}`); return; }
      if (!q.trim() && !cat) return;
      if (q.trim()) track("search", { query: q.trim(), lang });
      router.push(q.trim() ? `${base}?q=${encodeURIComponent(q.trim())}` : base);
    } else {
      if (!val && !cat) return;
      router.push(val ? `${base}?f.${FACET_KEY[tab]}=${encodeURIComponent(val)}` : base);
    }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? list.length - 1 : a - 1)); }
    else if (e.key === "Escape") setOpen(false);
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!d) return;
    e.preventDefault(); const dir = document.documentElement.dir === "rtl" ? -d : d; const n = tabs[(i + dir + tabs.length) % tabs.length].k;
    setTab(n); setVal(""); document.getElementById(`${id}-tab-${n}`)?.focus();
  };
  const opts = tab === "product" ? [] : facets[tab] ?? [];
  const field = "h-12 w-full border-0 bg-white px-3 text-[15px] text-foreground placeholder:text-steel-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <div ref={box} className="relative border border-steel-700 bg-white shadow-[6px_6px_0_0_var(--steel-200)]">
      <div className="flex items-stretch border-b border-steel-700">
        <span className="spec-label hidden items-center border-e border-steel-700 bg-steel-900 px-3 text-white sm:flex">{t.findBy}</span>
        <div role="tablist" aria-label={t.findBy} className="flex flex-1 overflow-x-auto no-scrollbar">
          {tabs.map((x, i) => {
            return (
              <button key={x.k} id={`${id}-tab-${x.k}`} role="tab" type="button" aria-selected={tab === x.k} aria-controls={`${id}-panel`} tabIndex={tab === x.k ? 0 : -1}
                onClick={() => { setTab(x.k); setVal(""); }} onKeyDown={(e) => onTabKey(e, i)}
                className={cn("relative min-h-11 flex-1 whitespace-nowrap border-e border-steel-200 px-3 text-sm font-medium transition-colors last:border-e-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  tab === x.k ? "bg-white text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "bg-steel-50 text-steel-600 hover:text-foreground")}>
                {x.label}
              </button>);
          })}
        </div>
      </div>
      <form id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} onSubmit={submit} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto]">
        <div className="relative border-b border-steel-200 sm:border-b-0 sm:border-e">
          <label htmlFor={`${id}-q`} className="spec-label absolute start-3 top-1.5 text-steel-500">{tabs.find((x) => x.k === tab)!.label}</label>
          {tab === "product" ? (
            <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onFocus={() => list.length && setOpen(true)} autoComplete="off" placeholder={t.placeholder}
              role="combobox" aria-expanded={open && list.length > 0} aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined} aria-autocomplete="list"
              className={cn(field, "pt-5")} />
          ) : opts.length ? (
            <select id={`${id}-q`} value={val} onChange={(e) => setVal(e.target.value)} className={cn(field, "appearance-none pt-5")}>
              <option value="">{t.choose}</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label} ({o.n})</option>)}
            </select>
          ) : <p id={`${id}-q`} className="flex h-12 items-end px-3 pb-2 text-sm text-steel-500">{t.unavailable}</p>}
        </div>
        <div className="relative border-b border-steel-200 sm:border-b-0 sm:border-e">
          <label htmlFor={`${id}-cat`} className="spec-label absolute start-3 top-1.5 text-steel-500">{t.category}</label>
          <select id={`${id}-cat`} value={cat} onChange={(e) => setCat(e.target.value)} className={cn(field, "appearance-none pt-5")}>
            <option value="">{t.anyCategory}</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="flex min-h-12 items-center justify-center gap-2 bg-primary px-6 font-semibold text-white transition-colors hover:bg-[#8e1e27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}{t.go}
        </button>
      </form>
      {tab === "product" && open && list.length > 0 && (
        <ul id={`${id}-list`} role="listbox" aria-label={t.suggestions} className="absolute inset-x-0 top-full z-30 border border-t-0 border-steel-700 bg-white shadow-xl">
          {list.map((s, i) => {
            const name = lang === "ar" && s.name_ar ? s.name_ar : s.name_en; const href = s.kind !== "category" ? `/${lang}/product/${s.slug}` : `/${lang}/category/${s.slug}`;
            const img = publicUrl(s.kind !== "category" ? "product-images" : "category-images", s.image_path);
            return (
              <li key={s.kind + s.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
                <Link href={href} onClick={() => setOpen(false)} className={cn("flex min-h-11 items-center gap-3 px-3 py-2 text-sm hover:bg-steel-50", i === active && "bg-steel-100")}>
                  {img ? <img src={img} alt="" className="size-8 bg-steel-50 object-contain" /> : s.kind !== "category" ? <ProductPlaceholder kind={placeholderKind({ name_en: s.name_en })} compact className="size-8 shrink-0" /> : <Folder className="size-4 text-steel-500" aria-hidden="true" />}
                  <span className="flex-1">{name}</span>{s.kind === "category" && <span className="spec-label text-steel-500">{t.categoryWord}</span>}
                </Link>
              </li>);
          })}
          <li role="presentation"><button type="button" onClick={submit} className="flex min-h-11 w-full items-center gap-2 border-t border-steel-200 px-3 text-start text-sm font-semibold text-primary hover:bg-steel-50">{t.viewAll}: “{q}”<ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></button></li>
        </ul>)}
    </div>
  );
}
