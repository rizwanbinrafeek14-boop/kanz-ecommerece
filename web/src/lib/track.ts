"use client";
import { createClient } from "@/lib/supabase/browser";

/** Anonymous first-party session id (no IP, no third-party cookies). */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem("kanz_sid");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("kanz_sid", id); }
    return id;
  } catch { return "unknown"; }
}

export interface TrackArgs { path?: string; product?: string; banner?: string; query?: string; lang?: string }
export function track(event: "page_view" | "product_view" | "search" | "banner_impression" | "banner_click" | "add_to_cart" | "whatsapp_click", a: TrackArgs = {}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  try {
    void createClient().rpc("track_event", {
      p_event: event, p_session: getSessionId(), p_path: a.path ?? window.location.pathname,
      p_product: a.product ?? null, p_banner: a.banner ?? null, p_query: a.query ?? null, p_lang: a.lang ?? document.documentElement.lang,
    }).then(() => {}, () => {});
  } catch { /* analytics must never break the page */ }
}
