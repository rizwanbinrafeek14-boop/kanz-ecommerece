import { Package } from "lucide-react";
import { publicUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlaceholderKind } from "@/lib/images/placeholder";
import { ProductPlaceholder } from "./product-placeholder";

/**
 * A stored image, or — for products without one — the labelled placeholder drawing of the product type
 * (`placeholder`), or a neutral icon for other images (logos, categories).
 */
export function ProductImage({ path, alt, className, bucket = "product-images", placeholder, lang, compact }: {
  path?: string | null; alt: string; className?: string; bucket?: string; placeholder?: PlaceholderKind; lang?: string; compact?: boolean;
}) {
  const url = publicUrl(bucket, path);
  if (!url) {
    if (placeholder) return <ProductPlaceholder kind={placeholder} lang={lang} alt={alt} className={className} compact={compact} />;
    return <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/50", className)} role="img" aria-label={alt}><Package className="size-1/3" /></div>;
  }
  // Plain <img>: uploads are already resized and converted to WebP in the browser before they are stored.
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={cn("bg-white object-contain", className)} />;
}
