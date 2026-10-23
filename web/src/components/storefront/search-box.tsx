"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Folder, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { publicUrl } from "@/lib/format";
import { track } from "@/lib/track";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Sugg { kind: "product" | "category"; id: string; slug: string; name_en: string; name_ar: string | null; image_path: string | null }

export function SearchBox({ lang, dict, className }: { lang: Locale; dict: Dictionary; className?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [fetched, setItems] = React.useState<Sugg[]>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const items = q.trim().length >= 2 ? fetched : [];
  const box = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (q.trim().length < 2 || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const t = setTimeout(async () => {
      setBusy(true);
      const { data } = await createClient().rpc("search_suggestions", { p_q: q.trim(), p_limit: 6 });
      setItems((data as Sugg[]) ?? []); setBusy(false); setOpen(true);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    track("search", { query: q.trim(), lang });
    setOpen(false);
    router.push(`/${lang}/products?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div ref={box} className={`relative ${className ?? ""}`}>
      <form onSubmit={submit} role="search" className="flex">
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => items.length && setOpen(true)} type="search" autoComplete="off"
          placeholder={dict.search.placeholder} aria-label={dict.common.search}
          className="h-11 w-full rounded-s-md border border-e-0 border-input bg-white px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" className="flex h-11 w-12 items-center justify-center rounded-e-md bg-primary text-white hover:bg-primary/90" aria-label={dict.common.search}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </button>
      </form>
      {open && items.length > 0 && (
        <div className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-md border bg-white text-foreground shadow-xl">
          <p className="px-3 pt-2 text-xs font-semibold uppercase text-muted-foreground">{dict.search.suggestions}</p>
          <ul>
            {items.map((s) => {
              const name = lang === "ar" && s.name_ar ? s.name_ar : s.name_en;
              const href = s.kind === "product" ? `/${lang}/product/${s.slug}` : `/${lang}/category/${s.slug}`;
              const img = publicUrl(s.kind === "product" ? "product-images" : "category-images", s.image_path);
              return (
                <li key={s.kind + s.id}>
                  <Link href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-accent">
                    {img ? <img src={img} alt="" className="size-9 rounded object-contain bg-muted" /> : <span className="flex size-9 items-center justify-center rounded bg-muted"><Folder className="size-4 text-muted-foreground" /></span>}
                    <span className="text-sm">{name}</span>
                    {s.kind === "category" && <span className="ms-auto text-xs text-muted-foreground">{dict.common.category}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button onClick={submit} className="block w-full border-t px-3 py-2 text-start text-sm font-medium text-primary hover:bg-accent">
            {dict.search.viewAllResults}: “{q}”
          </button>
        </div>
      )}
    </div>
  );
}
