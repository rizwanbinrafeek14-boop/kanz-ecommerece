"use client";
import * as React from "react";
import Link from "next/link";
import { Menu, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import type { CategoryNode } from "@/lib/queries/catalog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function MobileMenu({ tree, lang, dict }: { tree: CategoryNode[]; lang: Locale; dict: Dictionary }) {
  const nm = (c: { name_en: string; name_ar: string | null }) => (lang === "ar" && c.name_ar ? c.name_ar : c.name_en);
  return (
    <Sheet>
      <SheetTrigger className="p-2 lg:hidden" aria-label="Menu"><Menu className="size-6" /></SheetTrigger>
      <SheetContent side="start" className="overflow-y-auto">
        <SheetTitle className="border-b p-4 text-lg font-bold">{dict.nav.categories}</SheetTitle>
        <nav className="flex-1 p-2">
          {tree.map((c) => (
            <details key={c.id} className="group border-b last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 font-medium">
                {nm(c)} {c.children.length > 0 && <ChevronDown className="size-4 transition-transform group-open:rotate-180" />}
              </summary>
              <ul className="pb-2 ps-3">
                <li><SheetClose asChild><Link href={`/${lang}/category/${c.slug}`} className="block px-3 py-2 text-sm font-medium text-primary">{dict.common.viewAll}</Link></SheetClose></li>
                {c.children.map((ch) => (
                  <li key={ch.id}><SheetClose asChild><Link href={`/${lang}/category/${ch.slug}`} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground">{nm(ch)}</Link></SheetClose></li>
                ))}
              </ul>
            </details>
          ))}
          <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
            <SheetClose asChild><Link href={`/${lang}/rfq`} className="px-3 py-2 font-medium">{dict.nav.rfq}</Link></SheetClose>
            <SheetClose asChild><Link href={`/${lang}/about`} className="px-3 py-2">{dict.nav.about}</Link></SheetClose>
            <SheetClose asChild><Link href={`/${lang}/contact`} className="px-3 py-2">{dict.nav.contact}</Link></SheetClose>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
