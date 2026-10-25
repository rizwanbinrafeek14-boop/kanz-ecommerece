"use client";
/** Recently viewed products, kept only in this browser (localStorage). Never sent anywhere. */
export interface RecentItem { slug: string; name_en: string; name_ar: string | null; image: string | null }
const KEY = "kanz_recent"; const MAX = 8;
const listeners = new Set<() => void>();
let cache: RecentItem[] | null = null;
function read(): RecentItem[] { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; } return cache!; }
export function rememberProduct(it: RecentItem) {
  try { const next = [it, ...read().filter((x) => x.slug !== it.slug)].slice(0, MAX); cache = next; localStorage.setItem(KEY, JSON.stringify(next)); listeners.forEach((l) => l()); } catch { /* storage unavailable */ }
}
export function clearRecent() { try { cache = []; localStorage.removeItem(KEY); listeners.forEach((l) => l()); } catch { /* ignore */ } }
export const recentStore = {
  subscribe(cb: () => void) { listeners.add(cb); const s = (e: StorageEvent) => { if (e.key === KEY) { cache = null; cb(); } }; window.addEventListener("storage", s); return () => { listeners.delete(cb); window.removeEventListener("storage", s); }; },
  get: () => { try { return read(); } catch { return []; } },
  server: (): RecentItem[] => [],
};
