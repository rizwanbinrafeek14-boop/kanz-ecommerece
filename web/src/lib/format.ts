import type { Locale } from "@/lib/i18n/config";

export function formatSAR(amount: number | string | null | undefined, lang: Locale = "en"): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n);
}

export function formatDate(d: string | Date | null | undefined, lang: Locale = "en"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", { dateStyle: "medium" }).format(new Date(d));
}
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(d));
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** VAT maths mirrors the SQL functions: VAT is rounded per document, not per line. */
export function withVat(subtotal: number, vatRate: number) {
  const vat = round2((subtotal * vatRate) / 100);
  return { subtotal: round2(subtotal), vat, total: round2(subtotal + vat) };
}

export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Schedules are entered and shown in Saudi time (Asia/Riyadh, UTC+3, no DST). */
export function toRiyadhInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}
export function fromRiyadhInput(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(`${v}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
