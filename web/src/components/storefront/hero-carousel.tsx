"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { track } from "@/lib/track";
import type { Locale } from "@/lib/i18n/config";

export interface Slide { id: string; desktop: string | null; mobile: string | null; title: string; subtitle: string; cta: string; href: string | null; alt: string }

export function HeroCarousel({ slides, lang }: { slides: Slide[]; lang: Locale }) {
  const [i, setI] = React.useState(0);
  const seen = React.useRef(new Set<string>());
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    const s = slides[i];
    if (s && !seen.current.has(s.id)) { seen.current.add(s.id); track("banner_impression", { banner: s.id }); }
  }, [i, slides]);

  React.useEffect(() => {
    if (slides.length < 2) return;
    timer.current = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [slides.length]);

  const go = (n: number) => setI((n + slides.length) % slides.length);
  const rtl = lang === "ar";

  return (
    <section className="relative overflow-hidden bg-ink" aria-roledescription="carousel" aria-label="Promotions">
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(${(rtl ? 1 : -1) * i * 100}%)` }}>
        {slides.map((s) => {
          const body = (
            <>
              <picture>
                {s.mobile && <source media="(max-width: 767px)" srcSet={s.mobile} />}
                <img src={s.desktop ?? s.mobile ?? ""} alt={s.alt} className="h-[260px] w-full object-cover sm:h-[340px] lg:h-[460px]" />
              </picture>
              {(s.title || s.subtitle || s.cta) && (
                <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/70 via-black/30 to-transparent rtl:bg-gradient-to-l">
                  <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
                    <div className="max-w-xl text-white">
                      {s.title && <h2 className="text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{s.title}</h2>}
                      {s.subtitle && <p className="mt-3 text-sm text-white/85 sm:text-lg">{s.subtitle}</p>}
                      {s.cta && <span className="mt-5 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-semibold">{s.cta}</span>}
                    </div>
                  </div>
                </div>
              )}
            </>
          );
          return (
            <div key={s.id} className="relative w-full shrink-0" aria-roledescription="slide">
              {s.href ? <Link href={s.href} onClick={() => track("banner_click", { banner: s.id })} className="block">{body}</Link> : body}
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <>
          <button onClick={() => go(i - 1)} aria-label="Previous" className="absolute start-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:block"><ChevronLeft className="size-5 rtl:rotate-180" /></button>
          <button onClick={() => go(i + 1)} aria-label="Next" className="absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:block"><ChevronRight className="size-5 rtl:rotate-180" /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {slides.map((s, n) => <button key={s.id} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/50"}`} />)}
          </div>
        </>
      )}
    </section>
  );
}
