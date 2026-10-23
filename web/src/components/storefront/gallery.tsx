"use client";
import * as React from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function Gallery({ images, alt }: { images: { url: string; needsHires?: boolean }[]; alt: string }) {
  const [i, setI] = React.useState(0);
  if (!images.length) return <div className="flex aspect-square items-center justify-center rounded-xl border bg-muted text-muted-foreground/40"><Package className="size-20" /></div>;
  return (
    <div>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-white">
        <img src={images[i].url} alt={alt} className="size-full object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((im, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`Image ${n + 1}`}
              className={cn("size-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1", n === i && "border-primary ring-2 ring-primary/30")}>
              <img src={im.url} alt="" className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
