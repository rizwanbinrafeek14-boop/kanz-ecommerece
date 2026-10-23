import { Package } from "lucide-react";
import { publicUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductImage({ path, alt, className, bucket = "product-images" }: { path?: string | null; alt: string; className?: string; bucket?: string }) {
  const url = publicUrl(bucket, path);
  if (!url) {
    return <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/50", className)} role="img" aria-label={alt}><Package className="size-1/3" /></div>;
  }
  // Plain <img>: Supabase Storage serves already-optimised files and the host is configurable.
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={cn("bg-white object-contain", className)} />;
}
