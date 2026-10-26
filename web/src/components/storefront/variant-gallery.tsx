"use client";
import * as React from "react";
import { useSelectedVariant } from "@/lib/variant-store";
import { Gallery, type GalleryLabels } from "./gallery";

/**
 * Gallery that follows the selected configuration: a drawing tagged with options (e.g. {"style":"SW-IR/CR"}) is shown only when the
 * selected variant has those options, and comes first; untagged pictures are always shown. Before a selection (and for crawlers) all are shown.
 */
export function VariantGallery({ images, variants, alt, labels }: {
  images: { url: string; needsHires?: boolean; alt?: string; match?: Record<string, string> | null }[]; variants: { id: string; options?: Record<string, string> }[]; alt: string; labels: GalleryLabels;
}) {
  const vid = useSelectedVariant(); const opts = variants.find((v) => v.id === vid)?.options;
  const list = React.useMemo(() => {
    if (!opts) return images;
    const fits = (m?: Record<string, string> | null) => !!m && Object.entries(m).every(([k, v]) => opts[k] === v);
    const tagged = images.filter((i) => fits(i.match)); const general = images.filter((i) => !i.match);
    return [...tagged, ...general];
  }, [images, opts]);
  return <Gallery key={list.map((i) => i.url).join("|")} images={list} alt={alt} labels={labels} />;
}
