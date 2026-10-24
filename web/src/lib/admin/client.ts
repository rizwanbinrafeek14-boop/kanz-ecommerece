"use client";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";

/** Runs a server action and shows a toast for the outcome. Returns the data on success (`true` when the action returns no data), undefined on failure — so `if (await run(...))` is a reliable success check. */
export async function run<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, success?: string | ((d: T) => string)): Promise<T | undefined> {
  try {
    const r = await p;
    if (!r.ok) { toast.error(r.error, { duration: 8000 }); return undefined; }
    if (success) toast.success(typeof success === "function" ? success(r.data) : success);
    return (r.data ?? true) as T;
  } catch (e) { toast.error((e as Error).message || "Something went wrong"); return undefined; }
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"];

/** Uploads straight from the browser to Supabase Storage (the staff session + bucket policy authorise it). Returns the object path. */
export async function uploadToBucket(bucket: string, file: File, folder: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error(`${file.name}: unsupported file type`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: file is larger than 25 MB`);
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await createClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`${file.name}: ${error.message}`);
  return path;
}

export async function removeFromBucket(bucket: string, paths: string[]) {
  if (paths.length) await createClient().storage.from(bucket).remove(paths);
}

/** Certificate PDFs only (max 10 MB). Stored in product-docs/certificates/…; the server re-checks the path shape. */
export async function uploadCertificatePdf(file: File): Promise<string> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error("Certificates must be PDF files.");
  if (file.size > 10 * 1024 * 1024) throw new Error("The PDF is larger than 10 MB.");
  const base = file.name.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "certificate";
  return uploadToBucket("product-docs", new File([file], `${base}.pdf`, { type: "application/pdf" }), "certificates");
}
