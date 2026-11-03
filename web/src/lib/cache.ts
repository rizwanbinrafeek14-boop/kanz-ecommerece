import "server-only";
import { unstable_cache } from "next/cache";

/**
 * Server-side cache for PUBLIC storefront reads (anonymous client, published data only — never per-user data).
 * Pages that render per request (category, product list, brand, RFQ) would otherwise query Supabase 10-20 times on every visit;
 * on a host far from the database each query is a network round trip. Entries refresh every 60 s and are cleared at once by
 * refreshStorefront() after an admin change (tag "storefront"). Results must be JSON-serialisable (no Map / Date objects).
 */
export const STOREFRONT_TAG = "storefront";
export function cached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, revalidate = 60): (...args: A) => Promise<R> {
  return unstable_cache(fn, ["sf", key], { revalidate, tags: [STOREFRONT_TAG] });
}
