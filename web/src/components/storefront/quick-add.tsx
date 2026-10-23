"use client";
import { ClipboardPlus, Check } from "lucide-react";
import * as React from "react";
import { useCart } from "./cart-provider";
import { Button } from "@/components/ui/button";

export function QuickAddQuote({ product, label, addedLabel }: {
  product: { id: string; slug: string; name: string; image: string | null; unit: string }; label: string; addedLabel: string;
}) {
  const { add } = useCart();
  const [done, setDone] = React.useState(false);
  return (
    <Button size="sm" variant="outline" className="w-full" onClick={(e) => {
      e.preventDefault();
      add({ kind: "quote", productId: product.id, slug: product.slug, name: product.name, image: product.image, unit: product.unit });
      setDone(true); setTimeout(() => setDone(false), 1500);
    }}>
      {done ? <Check className="size-4" /> : <ClipboardPlus className="size-4" />} {done ? addedLabel : label}
    </Button>
  );
}
