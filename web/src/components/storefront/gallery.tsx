"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Package, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GalleryLabels { enlarge: string; zoomIn: string; zoomOut: string; close: string; prev: string; next: string; image: string }

/** Product gallery: thumbnails, click to open a lightbox with keyboard navigation and a 2.5× zoom you can pan by moving the pointer. */
export interface GalleryImage { url: string; thumb?: string | null; needsHires?: boolean; alt?: string; note?: string | null }
export function Gallery({ images, alt, labels, empty }: { images: GalleryImage[]; alt: string; labels: GalleryLabels; empty?: React.ReactNode }) {
  const [i, setI] = React.useState(0); const [open, setOpen] = React.useState(false); const [zoom, setZoom] = React.useState(false); const [origin, setOrigin] = React.useState("50% 50%");
  if (!images.length && empty) return <>{empty}</>;
  if (!images.length) return <div className="flex aspect-square items-center justify-center rounded-xl border bg-muted text-muted-foreground/40"><Package className="size-20" aria-hidden="true" /></div>;
  const go = (d: number) => { setI((n) => (n + d + images.length) % images.length); setZoom(false); };
  const move = (e: React.PointerEvent<HTMLDivElement>) => { if (!zoom) return; const r = e.currentTarget.getBoundingClientRect(); setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); };
  const thumbs = (cls: string) => images.length > 1 && (
    <div className={cn("flex gap-2 overflow-x-auto no-scrollbar", cls)}>
      {images.map((im, n) => (
        <button key={n} type="button" onClick={() => { setI(n); setZoom(false); }} aria-label={`${labels.image} ${n + 1}`} aria-current={n === i}
          className={cn("size-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", n === i && "border-primary ring-2 ring-primary/30")}>
          <img src={im.thumb || im.url} alt="" loading="lazy" className="size-full object-contain" />
        </button>))}
    </div>);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${labels.enlarge}: ${alt}`} className="group relative flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <img src={images[i].url} alt={images[i].alt ?? alt} className="size-full object-contain p-4" />
        <span className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-full bg-ink/80 text-white opacity-90"><Search className="size-4" aria-hidden="true" /></span>
      </button>
      {/* where the shown image comes from, e.g. "Image from the manufacturer's catalogue" (never claimed as our photograph) */}
      {images[i].note && <p className="mt-2 text-xs text-muted-foreground" data-image-note>{images[i].note}</p>}
      {thumbs("mt-3")}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setZoom(false); }}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }} className="flex h-[92vh] max-w-[min(1200px,96vw)] flex-col gap-3 p-3 sm:max-w-[min(1200px,96vw)]">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{alt}</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setZoom((z) => !z)} aria-pressed={zoom} aria-label={zoom ? labels.zoomOut : labels.zoomIn} className="flex size-11 items-center justify-center rounded-md border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}</button>
              <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} className="flex size-11 items-center justify-center rounded-md border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" /></button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-white" onPointerMove={move} onClick={() => setZoom((z) => !z)}>
            <img src={images[i].url} alt={images[i].alt ?? alt} style={{ transformOrigin: origin }} className={cn("size-full object-contain p-2 motion-safe:transition-transform motion-safe:duration-200", zoom ? "scale-[2.5] cursor-zoom-out" : "cursor-zoom-in")} />
            {images.length > 1 && <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={labels.prev} className="absolute start-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-6 rtl:rotate-180" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={labels.next} className="absolute end-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/80 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-6 rtl:rotate-180" /></button></>}
          </div>
          {thumbs("justify-center")}
        </DialogContent>
      </Dialog>
    </div>
  );
}
