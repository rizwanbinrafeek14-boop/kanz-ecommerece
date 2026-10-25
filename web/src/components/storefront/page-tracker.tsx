"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track";
import { rememberProduct, type RecentItem } from "@/lib/recent";

export function PageTracker({ lang }: { lang: string }) {
  const path = usePathname();
  useEffect(() => { track("page_view", { path, lang }); }, [path, lang]);
  return null;
}
export function ProductViewTracker({ productId, recent }: { productId: string; recent?: RecentItem }) {
  useEffect(() => { track("product_view", { product: productId }); if (recent) rememberProduct(recent); }, [productId, recent?.slug]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
