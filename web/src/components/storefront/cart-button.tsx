"use client";
import Link from "next/link";
import { ShoppingCart, ClipboardList } from "lucide-react";
import { useCart } from "./cart-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -top-1.5 -end-2 flex min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-primary">{n}</span>;
}
export function CartButtons({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { cart, quote } = useCart();
  return (
    <>
      <Link href={`/${lang}/rfq`} className="relative flex flex-col items-center gap-0.5 text-xs hover:text-white/80" aria-label={dict.cart.quoteList}>
        <ClipboardList className="size-5" /><span className="hidden sm:block">{dict.nav.quote}</span><Badge n={quote.length} />
      </Link>
      <Link href={`/${lang}/cart`} className="relative flex flex-col items-center gap-0.5 text-xs hover:text-white/80" aria-label={dict.nav.cart}>
        <ShoppingCart className="size-5" /><span className="hidden sm:block">{dict.nav.cart}</span><Badge n={cart.length} />
      </Link>
    </>
  );
}
