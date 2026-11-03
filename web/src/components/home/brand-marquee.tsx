"use client";
import * as React from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { ProductImage } from "@/components/storefront/product-image";

export interface MarqueeBrand { id: string; name: string; slug: string; logo_path: string | null }

/**
 * Brands moving in a continuous loop ("train"). The list is repeated so one copy always fills the strip, then shown twice and
 * shifted by exactly half its width, so the loop has no jump. Pauses on hover / keyboard focus and with the Pause button
 * (WCAG 2.2.2); with "reduce motion" it is a still, scrollable row. The second copy is hidden from screen readers.
 */
export function BrandMarquee({ brands, lang, labels }: { brands: MarqueeBrand[]; lang: string; labels: { pause: string; play: string; region: string } }) {
  const [paused, setPaused] = React.useState(false);
  const reps = Math.max(1, Math.ceil(10 / brands.length));   // at least ~10 tiles per copy so the strip is always full
  const one = Array.from({ length: reps }, () => brands).flat();
  const seconds = Math.max(20, one.length * 4);              // same speed whatever the number of brands
  const tile = (b: MarqueeBrand, i: number, copy: boolean) => (
    <li key={`${copy ? "b" : "a"}-${i}`} className="shrink-0 pe-4" {...(copy ? { "aria-hidden": true } : {})}>
      <Link href={`/${lang}/brand/${b.slug}`} tabIndex={copy || i >= brands.length ? -1 : undefined} title={b.name}
        className="group flex h-24 w-48 items-center justify-center rounded-lg border border-steel-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {b.logo_path
          ? <ProductImage path={b.logo_path} bucket="brand-logos" alt={copy ? "" : b.name} className="h-full w-full object-contain grayscale transition group-hover:grayscale-0" />
          : <span className="text-center text-base font-semibold tracking-wide text-steel-700 group-hover:text-primary">{b.name}</span>}
      </Link>
    </li>);
  return (
    <div className="relative" data-brand-marquee>
      <div className="marquee overflow-hidden" role="region" aria-label={labels.region} dir="ltr">
        <ul className="marquee-track py-2" style={{ "--marquee-duration": `${seconds}s`, animationPlayState: paused ? "paused" : undefined } as React.CSSProperties} data-paused={paused || undefined}>
          {one.map((b, i) => tile(b, i, false))}
          {one.map((b, i) => tile(b, i, true))}
        </ul>
      </div>
      <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} data-marquee-toggle
        className="marquee-toggle absolute -top-12 end-0 inline-flex min-h-10 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium text-steel-700 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}{paused ? labels.play : labels.pause}
      </button>
    </div>);
}
