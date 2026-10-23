"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";

export function PageTracker({ lang }: { lang: string }) {
  const path = usePathname();
  useEffect(() => { track("page_view", { path, lang }); }, [path, lang]);
  return null;
}
export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => { track("product_view", { product: productId }); }, [productId]);
  return null;
}
