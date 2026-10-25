"use client";
import * as React from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { clearRecent, recentStore } from "@/lib/recent";
import { publicUrl } from "@/lib/format";

/** Products this visitor opened recently (from localStorage). Renders nothing until there is something to show. */
export function RecentlyViewed({ lang, title, clear, note, num }: { lang: "en" | "ar"; title: string; clear: string; note: string; num: string }) {
  const items = React.useSyncExternalStore(recentStore.subscribe, recentStore.get, recentStore.server);
  if (!items.length) return null;
  return (
    <section id="s-recent" aria-labelledby="recent-h" className="scroll-mt-40 py-12">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-steel-200 pb-3">
        <div><p className="spec-label text-steel-500">{num}</p><h2 id="recent-h" className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2></div>
        <div className="text-end"><button type="button" onClick={clearRecent} className="min-h-10 text-sm font-medium text-primary hover:underline">{clear}</button><p className="text-xs text-steel-500">{note}</p></div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((it) => { const img = publicUrl("product-images", it.image); const name = lang === "ar" && it.name_ar ? it.name_ar : it.name_en; return (
          <li key={it.slug}><Link href={`/${lang}/product/${it.slug}`} className="group block border border-steel-200 bg-white p-2 transition-colors hover:border-steel-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex aspect-square items-center justify-center bg-steel-50">{img ? <img src={img} alt="" loading="lazy" className="size-full object-contain p-2" /> : <Package className="size-8 text-steel-300" aria-hidden="true" />}</span>
            <span className="mt-2 line-clamp-2 text-xs font-medium leading-snug">{name}</span>
          </Link></li>); })}
      </ul>
    </section>
  );
}
