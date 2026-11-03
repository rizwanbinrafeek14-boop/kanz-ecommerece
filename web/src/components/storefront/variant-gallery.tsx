"use client";
import * as React from "react";
import { useSelectedLightVariant } from "@/lib/product-data";
import { Gallery, type GalleryImage, type GalleryLabels } from "./gallery";

/**
 * Gallery that follows the selected configuration: a drawing tagged with options (e.g. {"style":"SW-IR/CR"}) is shown only when the
 * selected variant has those options, and comes first; untagged pictures are always shown. Before a selection (and for crawlers) all are shown.
 */
export function VariantGallery({ images, alt, labels, empty }: {
  images: (GalleryImage & { match?: Record<string, string> | null })[]; alt: string; labels: GalleryLabels; empty?: React.ReactNode;
}) {
  const opts = useSelectedLightVariant()?.options;
  const list = React.useMemo(() => {
    if (!opts) return images;
    const fits = (m?: Record<string, string> | null) => !!m && Object.entries(m).every(([k, v]) => opts[k] === v);
    const tagged = images.filter((i) => fits(i.match)); const general = images.filter((i) => !i.match);
    return [...tagged, ...general];
  }, [images, opts]);
  return <Gallery key={list.map((i) => i.url).join("|")} images={list} alt={alt} labels={labels} empty={empty} />;
}
