"use client";
import * as React from "react";
import { track } from "@/lib/track";

export interface CartLine {
  key: string; kind: "cart" | "quote"; productId: string; variantId?: string; slug: string; name: string;
  sku?: string; spec?: string; material?: string; image?: string | null; unitPrice?: number | null; qty: number; unit: string;
}
interface CartCtx {
  lines: CartLine[]; cart: CartLine[]; quote: CartLine[]; ready: boolean;
  add: (l: Omit<CartLine, "key" | "qty"> & { qty?: number }) => void;
  setQty: (key: string, qty: number) => void; remove: (key: string) => void; clear: (kind: "cart" | "quote") => void;
}
const Ctx = React.createContext<CartCtx | null>(null);
const STORE = "kanz_cart_v1";
const EMPTY: CartLine[] = [];

// localStorage-backed external store (SSR renders an empty cart; the client snapshot takes over after hydration).
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;
function snapshot(): CartLine[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORE); } catch { /* storage unavailable */ }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try { cachedLines = raw ? (JSON.parse(raw) as CartLine[]) : EMPTY; } catch { cachedLines = EMPTY; }
  }
  return cachedLines;
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === STORE) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
function write(next: CartLine[]) {
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = React.useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const ready = React.useSyncExternalStore(() => () => {}, () => true, () => false);

  const value = React.useMemo<CartCtx>(() => ({
    lines, ready, cart: lines.filter((l) => l.kind === "cart"), quote: lines.filter((l) => l.kind === "quote"),
    add(l) {
      const key = `${l.kind}:${l.variantId ?? l.productId}${l.material ? `:${l.material}` : ""}`;   // the same item in another material / grade is a separate line
      const existing = lines.find((x) => x.key === key);
      const qty = Math.max(1, l.qty ?? 1);
      write(existing ? lines.map((x) => (x.key === key ? { ...x, qty: x.qty + qty } : x)) : [...lines, { ...l, key, qty }]);
      if (l.kind === "cart") track("add_to_cart", { product: l.productId });
    },
    setQty: (key, qty) => write(lines.map((x) => (x.key === key ? { ...x, qty: Math.max(0.01, qty) } : x))),
    remove: (key) => write(lines.filter((x) => x.key !== key)),
    clear: (kind) => write(lines.filter((x) => x.kind !== kind)),
  }), [lines, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
