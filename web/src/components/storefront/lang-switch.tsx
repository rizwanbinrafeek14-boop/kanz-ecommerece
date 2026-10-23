"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

export function LangSwitch({ lang, label }: { lang: Locale; label: string }) {
  const path = usePathname();
  const sp = useSearchParams();
  const other: Locale = lang === "en" ? "ar" : "en";
  const rest = path.replace(/^\/(en|ar)/, "");
  const qs = sp.toString();
  return (
    <Link href={`/${other}${rest}${qs ? `?${qs}` : ""}`} hrefLang={other}
      onClick={() => { document.cookie = `kanz_lang=${other}; path=/; max-age=31536000; samesite=lax`; }}
      className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-white/80">
      <Languages className="size-4" /> {label}
    </Link>
  );
}
